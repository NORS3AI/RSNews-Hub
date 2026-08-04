import { describe, it, expect, afterEach, vi } from 'vitest';
import { optimizeConfig, shouldOptimize, targetType, keepOptimized, optimizeImage } from './optimize';
import type { ImageType } from './types';

const PNG: ImageType = { ext: 'png', mime: 'image/png' };

afterEach(() => { vi.unstubAllEnvs(); });

describe('optimizeConfig', () => {
  it('defaults to webp / 2000px / q80 / enabled', () => {
    expect(optimizeConfig()).toEqual({ enabled: true, maxDim: 2000, format: 'webp', quality: 80 });
  });
  it('reads env and clamps bad values back to defaults', () => {
    vi.stubEnv('IMAGE_OPTIMIZE', 'false');
    vi.stubEnv('IMAGE_FORMAT', 'jpeg');
    vi.stubEnv('IMAGE_MAX_DIM', '1200');
    vi.stubEnv('IMAGE_QUALITY', '65');
    expect(optimizeConfig()).toEqual({ enabled: false, maxDim: 1200, format: 'jpeg', quality: 65 });
    vi.stubEnv('IMAGE_FORMAT', 'bogus');
    vi.stubEnv('IMAGE_MAX_DIM', '3');       // below floor
    vi.stubEnv('IMAGE_QUALITY', '999');     // out of range
    const c = optimizeConfig();
    expect(c.format).toBe('webp');
    expect(c.maxDim).toBe(2000);
    expect(c.quality).toBe(80);
  });
});

describe('shouldOptimize', () => {
  const cfg = optimizeConfig();
  it('processes raster still images', () => {
    expect(shouldOptimize('png', cfg)).toBe(true);
    expect(shouldOptimize('jpg', cfg)).toBe(true);
    expect(shouldOptimize('webp', cfg)).toBe(true);
  });
  it('passes through gif (animation) and svg (vector)', () => {
    expect(shouldOptimize('gif', cfg)).toBe(false);
    expect(shouldOptimize('svg', cfg)).toBe(false);
  });
  it('is off when disabled', () => {
    expect(shouldOptimize('png', { ...cfg, enabled: false })).toBe(false);
  });
});

describe('targetType', () => {
  it('maps each target format', () => {
    expect(targetType(PNG, 'webp')).toEqual({ ext: 'webp', mime: 'image/webp' });
    expect(targetType(PNG, 'jpeg')).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(targetType(PNG, 'original')).toEqual(PNG);
  });
});

describe('keepOptimized policy', () => {
  it('same format: keep only if strictly smaller', () => {
    expect(keepOptimized(1000, 900, false)).toBe(true);
    expect(keepOptimized(1000, 1000, false)).toBe(false);
    expect(keepOptimized(1000, 1200, false)).toBe(false);
  });
  it('format change: allow up to ~10% larger (normalization)', () => {
    expect(keepOptimized(1000, 1050, true)).toBe(true);
    expect(keepOptimized(1000, 1200, true)).toBe(false);
  });
});

describe('optimizeImage (passthrough safety)', () => {
  it('returns the original untouched for a gif (no sharp call)', async () => {
    const gif = Buffer.from('GIF89a fake');
    const r = await optimizeImage(gif, { ext: 'gif', mime: 'image/gif' }, optimizeConfig());
    expect(r.optimized).toBe(false);
    expect(r.bytes).toBe(gif);
  });
  it('returns the original when optimization is disabled', async () => {
    const r = await optimizeImage(Buffer.from('x'), PNG, { ...optimizeConfig(), enabled: false });
    expect(r.optimized).toBe(false);
  });
});

// Real sharp-backed behavior. sharp is a project dependency, so this runs in CI.
describe('optimizeImage (sharp)', () => {
  async function makePng(w: number, h: number): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer();
  }

  it('downscales an oversized image and converts PNG → WebP', async () => {
    const big = await makePng(3000, 2000);
    const r = await optimizeImage(big, PNG, { enabled: true, maxDim: 1000, format: 'webp', quality: 80 });
    expect(r.optimized).toBe(true);
    expect(r.type).toEqual({ ext: 'webp', mime: 'image/webp' });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(r.bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width || 0, meta.height || 0)).toBeLessThanOrEqual(1000);
    expect(r.bytes.length).toBeLessThan(big.length);
  });

  it('does not enlarge an already-small image', async () => {
    const small = await makePng(300, 200);
    const r = await optimizeImage(small, PNG, { enabled: true, maxDim: 2000, format: 'webp', quality: 80 });
    if (r.optimized) {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(r.bytes).metadata();
      expect(Math.max(meta.width || 0, meta.height || 0)).toBeLessThanOrEqual(300);
    }
  });
});
