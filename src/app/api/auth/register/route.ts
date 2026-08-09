import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { sendEmail, renderEmail, escapeHtml } from '@/lib/email';
import { captureError } from '@/lib/logger';
import { isDelegatedAuth } from '@/lib/identity';
import { moderateText } from '@/lib/moderation';
import { rateLimit, clientIp } from '@/lib/rateLimit';

const schema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  // Production: accounts are created on the parent RS News site, not the hub.
  if (isDelegatedAuth()) return NextResponse.json({ error: 'Accounts are managed on the main RS News site.' }, { status: 403 });
  // Throttle account/email-send flooding: 5 sign-ups per IP per 10 minutes.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 600_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many sign-ups. Please wait a few minutes.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });

  const { name: rawName, email, password } = parsed.data;
  // A display name is user-generated text — moderate it (no links, short).
  const mod = moderateText(rawName, { maxLength: 60, allowLinks: false });
  if (mod.verdict === 'block') return NextResponse.json({ error: mod.reasons.join(' ') }, { status: 400 });
  const name = mod.cleaned;
  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });

    const count = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        role: count === 0 ? 'ADMIN' : 'USER', // first ever user becomes admin
        status: 'ACTIVE',
      },
    });

    await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, status: user.status });

    // Best-effort welcome email (a no-op unless an email provider is configured).
    await sendEmail({
      to: user.email,
      subject: 'Welcome to RS News Hub',
      html: renderEmail(`Welcome, ${escapeHtml(name)}`, `<p style="margin:0 0 12px">Your RS News Hub account is ready. Browse articles, follow topics, save clippings, and take the weekly pop quiz.</p><p style="margin:0"><a href="${process.env.SITE_URL || ''}/docs" style="color:#E97D34;font-weight:700">Start reading →</a></p>`),
      text: `Welcome, ${name}. Your RS News Hub account is ready.`,
    });

    return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    captureError(e, { route: 'auth/register' });
    return NextResponse.json({ error: 'Could not create the account. Please try again.' }, { status: 500 });
  }
}
