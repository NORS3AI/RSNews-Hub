// Identity orchestrator: pick the provider from AUTH_MODE and, for parent-backed
// modes, provision a local "mirror" User keyed to the member's externalId so all
// hub-owned state (votes, quiz responses, clips, favorites, reading) has a stable
// foreign key. `local` mode keeps the hub's own cookie login (dev/standalone).

import { prisma } from '@/lib/db';
import type { IdentityProvider, Member } from './types';
import { JwtIdentityProvider } from './jwt';
import { HeaderIdentityProvider } from './header';

export type AuthMode = 'local' | 'jwt' | 'header';
export type { Member } from './types';

/** Resolved auth mode. `local` = the hub authenticates (dev/standalone). */
export function authMode(): AuthMode {
  const m = (process.env.AUTH_MODE || 'local').toLowerCase();
  return m === 'jwt' || m === 'header' ? m : 'local';
}

/** True when logins are delegated to the parent site (production). */
export function isDelegatedAuth(): boolean {
  return authMode() !== 'local';
}

function provider(): IdentityProvider | null {
  switch (authMode()) {
    case 'jwt': return new JwtIdentityProvider();
    case 'header': return new HeaderIdentityProvider();
    default: return null; // local: handled by the hub's own session
  }
}

/** Resolve the verified member from the parent (null in local mode). */
export async function resolveMember(): Promise<Member | null> {
  const p = provider();
  return p ? p.resolve() : null;
}

// Map the parent's staff flag onto the hub's role model so requireAdmin works.
const roleFor = (m: Member) => (m.isStaff ? 'ADMIN' : 'USER');

/**
 * Ensure a local User row mirrors the verified member, refreshing cached
 * attributes (email/name/segmentation facets/role) on every visit. Returns the
 * hub User, or null if suspended/banned. Only used in delegated-auth modes.
 */
export async function provisionFromMember(m: Member) {
  const cached = {
    email: m.email || `${m.externalId}@members.local`,
    name: m.name || 'Member',
    role: roleFor(m),
    accountType: m.accountType || 'MEMBER',
    region: m.region ?? null,
    storeType: m.storeType ?? null,
  };
  const user = await prisma.user.upsert({
    where: { externalId: m.externalId },
    update: cached,
    create: { externalId: m.externalId, status: 'ACTIVE', passwordHash: '', ...cached },
    select: { id: true, email: true, name: true, role: true, status: true, bio: true, createdAt: true },
  });
  if (user.status === 'BANNED' || user.status === 'SUSPENDED') return null;
  return user;
}
