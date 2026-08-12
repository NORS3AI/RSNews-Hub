// SSRF guard for server-side fetches of user/editor-supplied URLs.
//
// A fetcher that takes an arbitrary URL (e.g. "dissect this news link") can be
// pointed at internal addresses — cloud metadata (169.254.169.254), localhost
// services, RFC1918 hosts — turning the server into a proxy for the attacker.
// Where the host is known ahead of time we allowlist it (see jotform.ts). Where
// it isn't (any public news domain is legitimate), we instead RESOLVE the host
// and refuse any address in a private/reserved range, and we re-check on every
// redirect hop (a public URL can 3xx into the internal network, and DNS can
// rebind between checks).
//
// The IP-classification helpers are pure and unit-tested; the DNS + redirect
// walking lives in assertPublicHttpUrl / safeFetch.

import { isIP } from 'net';
import { lookup } from 'dns/promises';

/** Parse a dotted IPv4 string into four octets, or null if malformed. */
function ipv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums as [number, number, number, number];
}

/** Is this IPv4 address in a private, loopback, link-local or reserved range? */
export function isPrivateIPv4(ip: string): boolean {
  const o = ipv4Octets(ip);
  if (!o) return true; // unparseable → treat as unsafe
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0 && o[2] === 0) return true; // 192.0.0/24 IETF
  if (a === 192 && b === 0 && o[2] === 2) return true; // 192.0.2/24 TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51 && o[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && o[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

/** Is this IPv6 address loopback, unspecified, ULA, link-local or multicast?
 *  IPv4-mapped/embedded forms are delegated to the IPv4 check. */
export function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // strip any zone id
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) embed an IPv4 addr.
  const embedded = addr.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (embedded) return isPrivateIPv4(embedded[1]);
  const head = addr.split(':')[0] || '';
  const h = parseInt(head, 16);
  if (!Number.isNaN(h)) {
    if ((h & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((h & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((h & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  }
  return false;
}

/** Classify any IP literal (v4 or v6) as private/reserved (unsafe to fetch). */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP → unsafe
}

export class SsrfError extends Error {}

/**
 * Assert a URL is an http(s) address that resolves ONLY to public IPs. Throws
 * SsrfError otherwise. Returns the parsed URL on success. Resolves every A/AAAA
 * record and rejects if any is private, so a host with one public and one
 * internal record can't slip through.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new SsrfError('invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new SsrfError('only http(s) is allowed');
  if (u.username || u.password) throw new SsrfError('credentials in URL are not allowed');
  const host = u.hostname;
  // Literal IP host: classify directly (no DNS).
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError('URL resolves to a private address');
    return u;
  }
  // Hostname: resolve all records and reject if ANY is private.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfError('could not resolve host');
  }
  if (!addrs.length) throw new SsrfError('could not resolve host');
  for (const a of addrs) if (isPrivateIp(a.address)) throw new SsrfError('URL resolves to a private address');
  return u;
}

/**
 * fetch() that validates the target — and each redirect hop — is public, closing
 * the "public URL 302s into the internal network" hole. Follows up to `maxHops`
 * redirects manually. Throws SsrfError if any hop is unsafe.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}, maxHops = 4): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    const u = await assertPublicHttpUrl(current);
    const res = await fetch(u.toString(), { ...init, redirect: 'manual' });
    // Manual redirect handling so we can re-validate the next hop's host.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res; // redirect with no target — hand back as-is
      current = new URL(loc, u).toString();
      continue;
    }
    return res;
  }
  throw new SsrfError('too many redirects');
}
