import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { isDelegatedAuth } from '@/lib/identity';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  // In production the parent site handles login; the hub's own login is disabled.
  if (isDelegatedAuth()) return NextResponse.json({ error: 'Sign in on the main RS News site; the hub opens automatically for members.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  if (user.status === 'BANNED') return NextResponse.json({ error: 'This account has been banned.' }, { status: 403 });
  if (user.status === 'SUSPENDED') return NextResponse.json({ error: 'This account is suspended. Contact an administrator.' }, { status: 403 });

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, status: user.status });
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}
