// Server side of admin "View as": read the cookie, but honor it ONLY when the
// real signed-in account is staff/admin. Everything gate-related on the reader
// surfaces resolves its effective audience through here.

import { cookies } from 'next/headers';
import { listAdvertisers } from './adsServer';
import { VIEW_AS_COOKIE, resolveViewAs, type ViewAsPreset } from './viewAs';

type RoleLike = { role?: string | null } | null | undefined;

/** True when this real account is allowed to use View-as (staff/admin). */
export function canViewAs(user: RoleLike): boolean {
  return !!user && (user.role === 'ADMIN' || user.role === 'EDITOR');
}

/**
 * The active View-as preset for this request, or null. Returns null for
 * non-admins even if the cookie is present, so impersonation can never be
 * self-granted. `real` is the real signed-in account (needs its role).
 */
export async function activeViewAs(real: RoleLike): Promise<ViewAsPreset | null> {
  if (!canViewAs(real)) return null;
  const cookieVal = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!cookieVal) return null;
  const brands = (await listAdvertisers()).map((a) => a.brand);
  return resolveViewAs(cookieVal, brands);
}
