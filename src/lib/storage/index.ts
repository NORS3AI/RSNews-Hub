// Asset storage — the single entry point the rest of the app uses.
//
// Safe-by-default (mirrors src/lib/email.ts): with no cloud configured it stores
// uploads on local disk, which always works with zero setup. Set the S3_* env
// vars to switch to AWS S3 / Cloudflare R2 — no code change. Adding another
// backend (Cloudinary, GCS…) is one new file implementing StorageAdapter plus a
// case in `getAdapter()`.
//
// Keys are content-addressed (sha256), so identical bytes are stored once and
// every stored object is immutable and cache-forever.

import { log } from '../logger';
import type { StorageAdapter, PutResult } from './types';
import { validateMedia, assetKey } from './sniff';
import { optimizeImage, optimizeConfig } from './optimize';
import { LocalAdapter } from './local';
import { S3Adapter } from './s3';

export { validateImage, validateMedia, assetKey, sniffImage, sniffVideo, KEY_RE, contentTypeForKey } from './sniff';
export { optimizeImage, optimizeConfig, keepOptimized, shouldOptimize } from './optimize';
export type { StorageAdapter, PutResult } from './types';
export { uploadDir } from './local';

/** Which backend is active, from env. Never throws. */
export function storageMode(): 'local' | 's3' {
  const driver = process.env.STORAGE_DRIVER;
  if (driver === 's3') return 's3';
  if (driver === 'local') return 'local';
  // Auto: if a bucket is configured, use S3; otherwise local.
  return process.env.S3_BUCKET ? 's3' : 'local';
}

/** Max image upload size in bytes (env UPLOAD_MAX_MB, default 8MB). */
export function maxUploadBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 8) * 1024 * 1024;
}

/** Max video upload size in bytes (env UPLOAD_VIDEO_MAX_MB, default 20MB). */
export function maxVideoBytes(): number {
  const mb = Number(process.env.UPLOAD_VIDEO_MAX_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 20) * 1024 * 1024;
}

/** SVG uploads are off unless explicitly allowed (they can carry script). */
export function svgAllowed(): boolean {
  return process.env.UPLOAD_ALLOW_SVG === 'true';
}

let cached: StorageAdapter | null = null;
let cachedMode: string | null = null;

/** The active adapter (memoized until the mode changes, e.g. in tests). */
export function getAdapter(): StorageAdapter {
  const mode = storageMode();
  if (cached && cachedMode === mode) return cached;
  cachedMode = mode;
  cached = mode === 's3' ? new S3Adapter() : new LocalAdapter();
  return cached;
}

// For tests: drop the memoized adapter so env changes take effect.
export function _resetAdapter(): void { cached = null; cachedMode = null; }

/**
 * Validate + store image bytes. Returns the public URL to persist. Never throws;
 * on any failure returns `{ ok:false, error }` so callers can respond cleanly.
 */
/**
 * Validate + store an uploaded asset — an image always, and a silent video when
 * `allowVideo` is set (for ad creatives). Images are optimized before hashing;
 * videos are stored as-is (no server-side transcode). Never throws.
 */
export async function putAsset(bytes: Buffer, opts: { allowVideo?: boolean } = {}): Promise<PutResult> {
  const v = validateMedia(bytes, { imageMax: maxUploadBytes(), videoMax: maxVideoBytes(), allowSvg: svgAllowed(), allowVideo: opts.allowVideo });
  if (!v.ok) return { ok: false, error: v.error };

  let outBytes = bytes;
  let ext = v.type.ext;
  let mime = v.type.mime;
  if (v.type.kind === 'image') {
    // Optimize before hashing so the stored object IS the optimized one.
    const opt = await optimizeImage(bytes, { ext: v.type.ext, mime: v.type.mime }, optimizeConfig());
    outBytes = opt.bytes; ext = opt.type.ext; mime = opt.type.mime;
  }

  const key = assetKey(outBytes, ext);
  const adapter = getAdapter();
  try {
    await adapter.put(key, outBytes, mime);
  } catch (e) {
    log.error('asset store failed', { backend: adapter.kind, err: (e as Error).message });
    return { ok: false, error: 'storage backend error' };
  }
  return { ok: true, url: adapter.publicUrl(key), key, dedup: false };
}

/** Image-only convenience wrapper (the common case). */
export function putImage(bytes: Buffer): Promise<PutResult> {
  return putAsset(bytes, { allowVideo: false });
}
