import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { isDelegatedAuth } from '@/lib/identity';
import { rateLimit, clientIp } from '@/lib/rateLimit';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// A real bcrypt hash (cost 10) of a fixed throwaway string. When the email is
// unknown we still compare against this so the request takes the same time as a
// wrong password for a real account — no user-enumeration timing side-channel.
const DUMMY_HASH = '$2a$10$Vz./KBJjaHMPOJ.CsDtTGOk91SIaGoI2npFE.gkM4aadtvwbz/noW';

export async function POST(req: Request) {
  // In production the parent site handles login; the hub's own login is disabled.
  if (isDelegatedAuth()) return NextResponse.json({ error: 'Sign in on the main RS News site; the hub opens automatically for members.' }, { status: 403 });
  // Throttle brute-force: 10 attempts per IP per minute.
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always run a bcrypt compare, even when the email is unknown, so response
  // timing doesn't reveal whether an account exists (user-enumeration oracle).
  const hash = user?.passwordHash || DUMMY_HASH;
  const passwordOk = await verifyPassword(parsed.data.password, hash);
  if (!user || !passwordOk) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  if (user.status === 'BANNED') return NextResponse.json({ error: 'This account has been banned.' }, { status: 403 });
  if (user.status === 'SUSPENDED') return NextResponse.json({ error: 'This account is suspended. Contact an administrator.' }, { status: 403 });

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, status: user.status });
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}
