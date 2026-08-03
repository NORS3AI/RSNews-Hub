import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });

  const { name, email, password } = parsed.data;
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
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
}
