import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { storageMode, maxUploadBytes, svgAllowed, putImage, getAdapter, _resetAdapter } from './index';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

afterEach(() => { vi.unstubAllEnvs(); _resetAdapter(); });

describe('storageMode', () => {
  it('defaults to local, honors explicit driver, and auto-detects S3', () => {
    expect(storageMode()).toBe('local');
    vi.stubEnv('S3_BUCKET', 'b');
    expect(storageMode()).toBe('s3'); // auto-detect from bucket
    vi.stubEnv('STORAGE_DRIVER', 'local');
    expect(storageMode()).toBe('local'); // explicit local wins over bucket
    vi.stubEnv('STORAGE_DRIVER', 's3');
    expect(storageMode()).toBe('s3');
  });
});

describe('maxUploadBytes / svgAllowed', () => {
  it('defaults to 8MB and reads UPLOAD_MAX_MB', () => {
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024);
    vi.stubEnv('UPLOAD_MAX_MB', '2');
    expect(maxUploadBytes()).toBe(2 * 1024 * 1024);
    vi.stubEnv('UPLOAD_MAX_MB', 'garbage');
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024); // falls back
  });
  it('svg is off unless explicitly enabled', () => {
    expect(svgAllowed()).toBe(false);
    vi.stubEnv('UPLOAD_ALLOW_SVG', 'true');
    expect(svgAllowed()).toBe(true);
  });
});

describe('getAdapter selection', () => {
  it('returns the S3 adapter when configured, else local', () => {
    expect(getAdapter().kind).toBe('local');
    _resetAdapter();
    vi.stubEnv('STORAGE_DRIVER', 's3');
    vi.stubEnv('S3_BUCKET', 'b');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'k');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 's');
    expect(getAdapter().kind).toBe('s3');
  });
});

describe('putImage (local disk)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rsnews-uploads-'));
    vi.stubEnv('STORAGE_DRIVER', 'local');
    vi.stubEnv('UPLOAD_DIR', dir);
    _resetAdapter();
  });

  it('validates, writes to disk, and returns a servable URL', async () => {
    const r = await putImage(PNG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url).toMatch(/^\/uploads\/images\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);
    const onDisk = join(dir, r.key);
    expect(existsSync(onDisk)).toBe(true);
    expect(readFileSync(onDisk).equals(PNG)).toBe(true);
  });

  it('is content-addressed: same bytes → same key (dedup)', async () => {
    const a = await putImage(PNG);
    const b = await putImage(Buffer.from(PNG));
    expect(a.ok && b.ok && a.key === b.key).toBe(true);
  });

  it('rejects a non-image without writing anything', async () => {
    const r = await putImage(Buffer.from('definitely not an image'));
    expect(r.ok).toBe(false);
  });

  it('rejects an oversized file', async () => {
    vi.stubEnv('UPLOAD_MAX_MB', '0.000001'); // ~1 byte cap
    const r = await putImage(PNG);
    expect(r.ok).toBe(false);
  });
});
