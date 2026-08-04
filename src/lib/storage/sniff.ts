// Image type detection + upload validation — pure, no I/O, fully unit-tested.
//
// We NEVER trust the client-declared MIME type or filename. The stored type is
// decided by sniffing magic bytes from the actual content, which also decides
// the file extension. SVG is gated off by default because it can carry script.

import { createHash } from 'crypto';
import type { ImageType } from './types';

// Raster types we always accept. Ordered so more specific checks win.
const RASTER: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: 'png', mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  // WEBP: "RIFF"...."WEBP"
  { ext: 'webp', mime: 'image/webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

/** True if the bytes look like an SVG document (text-based, XML). */
export function looksLikeSvg(b: Buffer): boolean {
  const head = b.toString('utf8', 0, Math.min(b.length, 256)).trim().toLowerCase();
  // Skip a UTF-8 BOM / leading whitespace already trimmed; allow an XML prolog.
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')) || head.startsWith('<!doctype svg');
}

/**
 * Sniff an allowed image type from content. Returns null for anything not
 * allowed. SVG is only allowed when `allowSvg` is true (env-gated upstream).
 */
export function sniffImage(bytes: Buffer, allowSvg = false): ImageType | null {
  for (const t of RASTER) if (t.test(bytes)) return { ext: t.ext, mime: t.mime };
  if (allowSvg && looksLikeSvg(bytes)) return { ext: 'svg', mime: 'image/svg+xml' };
  return null;
}

export type Validation =
  | { ok: true; type: ImageType }
  | { ok: false; error: string };

/**
 * Validate an upload: non-empty, within the size cap, and a recognized image
 * type. `maxBytes` and `allowSvg` come from env (resolved by the caller).
 */
export function validateImage(bytes: Buffer, maxBytes: number, allowSvg = false): Validation {
  if (!bytes || bytes.length === 0) return { ok: false, error: 'empty file' };
  if (bytes.length > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `file too large (max ${mb}MB)` };
  }
  const type = sniffImage(bytes, allowSvg);
  if (!type) return { ok: false, error: 'unsupported image type (allowed: png, jpg, gif, webp)' };
  return { ok: true, type };
}

/**
 * Content-addressed storage key: sha256(bytes) + extension. Identical bytes map
 * to the same key, so uploads dedup for free and the object is immutable (can be
 * cached forever). Sharded by the first two hex chars to avoid huge flat dirs.
 */
export function assetKey(bytes: Buffer, ext: string): string {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return `images/${hash.slice(0, 2)}/${hash}.${ext}`;
}

// A stored local key must match this exactly — the serve route uses it to reject
// path traversal and anything that isn't one of our own content-addressed keys.
export const KEY_RE = /^images\/[0-9a-f]{2}\/[0-9a-f]{64}\.[a-z0-9]+$/;

/** MIME type for serving, derived from a key's extension. */
export function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}
