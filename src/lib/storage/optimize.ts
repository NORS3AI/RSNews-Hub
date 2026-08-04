// Automatic image optimization on upload.
//
// Runs inside the storage pipeline before the content-addressed key is computed,
// so the optimized bytes are what gets stored + hashed. Uses sharp when it's
// available; if sharp is missing or the decode fails, it SAFELY falls back to
// storing the original (uploads never break — same ethos as email/storage).
//
// What it does: auto-orient from EXIF, strip metadata (incl. GPS — a privacy
// win), downscale to a max dimension, and re-encode (WebP by default). Animated
// GIFs and SVGs pass through untouched.

import { log } from '../logger';
import type { ImageType } from './types';

export type TargetFormat = 'webp' | 'jpeg' | 'png' | 'original';

export type OptimizeConfig = {
  enabled: boolean;
  maxDim: number;      // longest-edge cap in px
  format: TargetFormat;
  quality: number;     // 1..100
};

/** Resolve optimization settings from env (all optional; sensible defaults). */
export function optimizeConfig(): OptimizeConfig {
  const maxDim = Number(process.env.IMAGE_MAX_DIM);
  const quality = Number(process.env.IMAGE_QUALITY);
  const fmt = (process.env.IMAGE_FORMAT || 'webp').toLowerCase();
  return {
    enabled: process.env.IMAGE_OPTIMIZE !== 'false', // on unless explicitly disabled
    maxDim: Number.isFinite(maxDim) && maxDim >= 16 ? maxDim : 2000,
    format: (['webp', 'jpeg', 'png', 'original'] as const).includes(fmt as TargetFormat) ? (fmt as TargetFormat) : 'webp',
    quality: Number.isFinite(quality) && quality >= 1 && quality <= 100 ? quality : 80,
  };
}

// Formats we never re-encode: GIF may be animated (sharp would flatten to one
// frame), SVG is vector/text. Both are passed through as-is.
const PASSTHROUGH = new Set(['gif', 'svg']);

/** Whether an input of this extension should be run through sharp. Pure. */
export function shouldOptimize(inputExt: string, cfg: OptimizeConfig): boolean {
  return cfg.enabled && !PASSTHROUGH.has(inputExt);
}

/** The output image type for a chosen target format (or the input if 'original'). Pure. */
export function targetType(input: ImageType, format: TargetFormat): ImageType {
  switch (format) {
    case 'webp': return { ext: 'webp', mime: 'image/webp' };
    case 'jpeg': return { ext: 'jpg', mime: 'image/jpeg' };
    case 'png': return { ext: 'png', mime: 'image/png' };
    case 'original': return input;
  }
}

/**
 * Decide whether to keep the optimized bytes or fall back to the original.
 * Rule: never store something larger than the source *unless* we changed format
 * (a format switch is an intentional normalization, e.g. PNG photo → WebP, and
 * is still capped by the downscale). Pure — the core policy, unit-tested.
 */
export function keepOptimized(originalLen: number, optimizedLen: number, formatChanged: boolean): boolean {
  if (formatChanged) return optimizedLen < originalLen * 1.1; // allow ~10% for a normalized format
  return optimizedLen < originalLen; // same format: only if strictly smaller
}

export type Optimized = { bytes: Buffer; type: ImageType; optimized: boolean };

/**
 * Optimize image bytes. Never throws: on any problem (sharp absent, bad decode,
 * a result that isn't smaller) it returns the original bytes/type unchanged.
 */
export async function optimizeImage(bytes: Buffer, input: ImageType, cfg: OptimizeConfig): Promise<Optimized> {
  const original: Optimized = { bytes, type: input, optimized: false };
  if (!shouldOptimize(input.ext, cfg)) return original;

  let sharpFn: (typeof import('sharp'))['default'];
  try {
    sharpFn = (await import('sharp')).default;
  } catch {
    log.warn('image optimize skipped: sharp not available');
    return original;
  }

  try {
    const out = targetType(input, cfg.format);
    const formatChanged = out.ext !== input.ext;

    // failOn:'none' → don't reject slightly-corrupt files; rotate() bakes EXIF
    // orientation; metadata is stripped by default (no withMetadata()).
    let pipe = sharpFn(bytes, { failOn: 'none' }).rotate();
    const meta = await pipe.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    if (longest > cfg.maxDim) {
      pipe = pipe.resize({ width: cfg.maxDim, height: cfg.maxDim, fit: 'inside', withoutEnlargement: true });
    }

    switch (cfg.format) {
      case 'webp': pipe = pipe.webp({ quality: cfg.quality }); break;
      case 'jpeg': pipe = pipe.jpeg({ quality: cfg.quality, mozjpeg: true }); break;
      case 'png': pipe = pipe.png({ compressionLevel: 9 }); break;
      case 'original': break; // keep source codec, just re-encoded/resized
    }

    const result = await pipe.toBuffer();
    if (!keepOptimized(bytes.length, result.length, formatChanged)) return original;
    return { bytes: result, type: out, optimized: true };
  } catch (e) {
    log.warn('image optimize failed; storing original', { err: (e as Error).message });
    return original;
  }
}
