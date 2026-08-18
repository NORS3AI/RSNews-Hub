import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { getAuthSecret } from './env';
import { authMode, resolveMember, provisionFromMember } from './identity';

const COOKIE_NAME = 'rsnews_session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getAuthSecret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Delegated auth (production): the member comes from the parent site. Key on
  // the local mirror's id so all per-account state lines up; null until the
  // mirror is provisioned (first full page load via getCurrentUser).
  if (authMode() !== 'local') {
    const member = await resolveMember();
    if (!member) return null;
    const u = await prisma.user.findUnique({
      where: { externalId: member.externalId },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    // Banned/suspended members must not act even with a still-valid parent token.
    if (!u || u.status === 'BANNED' || u.status === 'SUSPENDED') return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status };
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    // Pin the algorithm + require an expiry, matching the delegated parent-JWT
    // verifier. Symmetric key already precludes RS/none, but this is explicit.
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ['HS256'], requiredClaims: ['exp'] });
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      status: payload.status as string,
    };
  } catch {
    return null;
  }
}

// Loads the fresh user record, ensuring status changes (ban/suspend) take effect
// immediately. In delegated-auth modes (production: the parent site verifies the
// member), the identity comes from the parent and a local mirror User is
// provisioned; in `local` mode it's the hub's own cookie session.
export async function getCurrentUser() {
  if (authMode() !== 'local') {
    const member = await resolveMember();
    if (!member) return null;
    return provisionFromMember(member); // upserts the mirror; null if suspended/banned
  }
  const session = await getSessionUser();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, status: true, bio: true, createdAt: true, accountType: true, tier: true, affiliations: true, vendorBrand: true },
  });
  // Re-check status on every request so an admin ban OR suspension takes effect
  // immediately, even against a still-valid 7-day session token. (Matches the
  // login route and the delegated-auth path, which both reject SUSPENDED too.)
  if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') return null;
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'EDITOR')) return null;
  return user;
}

// Anonymous reading is tracked with a stable per-browser session id cookie.
export async function getReaderSessionId(): Promise<string | null> {
  return (await cookies()).get('rsnews_reader')?.value ?? null;
}
