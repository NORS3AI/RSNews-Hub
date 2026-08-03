import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getUserById } from './users';
import type { Role, User } from './types';

const COOKIE_NAME = 'rsnews_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || 'insecure-dev-secret-change-me';
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Create a signed, tamper-evident token: base64(payload).hmac */
export function signToken(payload: Record<string, unknown>): string {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = base64url(crypto.createHmac('sha256', secret()).update(body).digest());
  // constant-time comparison
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (json.exp && Date.now() > json.exp) return null;
    return json as T;
  } catch {
    return null;
  }
}

export async function createSession(userId: number): Promise<void> {
  const token = signToken({ uid: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken<{ uid: number }>(token);
  if (!payload?.uid) return null;
  const user = getUserById(payload.uid);
  // Banned users are treated as logged out.
  if (!user || user.status === 'banned') return null;
  return user;
}

export function isStaff(user: User | null): boolean {
  return !!user && (user.role === 'admin' || user.role === 'editor');
}

export function hasRole(user: User | null, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}
