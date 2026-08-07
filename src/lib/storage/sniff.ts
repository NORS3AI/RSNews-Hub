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

/** Content-addressed key for a generated article-audio MP3 (TTS). */
export function audioKey(bytes: Buffer): string {
  return `audio/${createHash('sha256').update(bytes).digest('hex')}.mp3`;
}

// A stored local key must match one of these exactly — the serve route uses them
// to reject path traversal and anything that isn't one of our content-addressed
// objects (images, or generated article-audio MP3s).
export const KEY_RE = /^images\/[0-9a-f]{2}\/[0-9a-f]{64}\.[a-z0-9]+$/;
export const AUDIO_KEY_RE = /^audio\/[0-9a-f]{64}\.mp3$/;
export const isServableKey = (key: string): boolean => KEY_RE.test(key) || AUDIO_KEY_RE.test(key);

/** MIME type for serving, derived from a key's extension. */
export function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    default: return 'application/octet-stream';
  }
}

// Silent video-ad creatives. Detected by magic bytes like images — MP4 by its
// 'ftyp' box, WebM by the EBML header — never by the client-declared type.
export function sniffVideo(bytes: Buffer): ImageType | null {
  if (bytes.length > 12 && bytes.toString('ascii', 4, 8) === 'ftyp') return { ext: 'mp4', mime: 'video/mp4' };
  if (bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { ext: 'webm', mime: 'video/webm' };
  return null;
}

export type MediaKind = 'image' | 'video';
export type MediaType = ImageType & { kind: MediaKind };
export type MediaValidation = { ok: true; type: MediaType } | { ok: false; error: string };

/**
 * Validate an upload as an image or (when allowed) a silent video, with a
 * per-kind size cap. Type is always sniffed from content.
 */
export function validateMedia(
  bytes: Buffer,
  opts: { imageMax: number; videoMax: number; allowSvg?: boolean; allowVideo?: boolean },
): MediaValidation {
  if (!bytes || bytes.length === 0) return { ok: false, error: 'empty file' };
  const img = sniffImage(bytes, opts.allowSvg);
  if (img) {
    if (bytes.length > opts.imageMax) return { ok: false, error: `image too large (max ${(opts.imageMax / 1048576).toFixed(0)}MB)` };
    return { ok: true, type: { ...img, kind: 'image' } };
  }
  if (opts.allowVideo) {
    const vid = sniffVideo(bytes);
    if (vid) {
      if (bytes.length > opts.videoMax) return { ok: false, error: `video too large (max ${(opts.videoMax / 1048576).toFixed(0)}MB)` };
      return { ok: true, type: { ...vid, kind: 'video' } };
    }
  }
  return { ok: false, error: opts.allowVideo ? 'unsupported file (allowed: png, jpg, gif, webp, mp4, webm)' : 'unsupported image type (allowed: png, jpg, gif, webp)' };
}
