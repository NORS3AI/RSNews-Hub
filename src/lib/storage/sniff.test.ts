import { describe, it, expect } from 'vitest';
import { sniffImage, validateImage, assetKey, KEY_RE, contentTypeForKey, looksLikeSvg } from './sniff';

// Minimal valid magic-byte headers for each type.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([0, 0])]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const TXT = Buffer.from('hello, not an image');

describe('sniffImage', () => {
  it('detects raster types by magic bytes', () => {
    expect(sniffImage(PNG)).toEqual({ ext: 'png', mime: 'image/png' });
    expect(sniffImage(JPG)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffImage(GIF)).toEqual({ ext: 'gif', mime: 'image/gif' });
    expect(sniffImage(WEBP)).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it('rejects non-images and rejects SVG unless explicitly allowed', () => {
    expect(sniffImage(TXT)).toBeNull();
    expect(sniffImage(SVG)).toBeNull(); // default: SVG off
    expect(sniffImage(SVG, true)).toEqual({ ext: 'svg', mime: 'image/svg+xml' });
  });

  it('does not misclassify a text file as WEBP (RIFF guard)', () => {
    expect(sniffImage(Buffer.from('RIFF but not webp here'))).toBeNull();
  });
});

describe('looksLikeSvg', () => {
  it('recognizes <svg> and xml-prolog svg', () => {
    expect(looksLikeSvg(SVG)).toBe(true);
    expect(looksLikeSvg(Buffer.from('<?xml version="1.0"?><svg></svg>'))).toBe(true);
    expect(looksLikeSvg(Buffer.from('<html></html>'))).toBe(false);
  });
});

describe('validateImage', () => {
  const MAX = 8 * 1024 * 1024;
  it('accepts a valid image within the cap', () => {
    expect(validateImage(PNG, MAX)).toEqual({ ok: true, type: { ext: 'png', mime: 'image/png' } });
  });
  it('rejects empty, oversized, and unsupported', () => {
    expect(validateImage(Buffer.alloc(0), MAX).ok).toBe(false);
    expect(validateImage(Buffer.concat([PNG, Buffer.alloc(MAX)]), MAX)).toMatchObject({ ok: false });
    expect(validateImage(TXT, MAX)).toMatchObject({ ok: false });
  });
  it('honors the SVG gate', () => {
    expect(validateImage(SVG, MAX).ok).toBe(false);
    expect(validateImage(SVG, MAX, true).ok).toBe(true);
  });
});

describe('assetKey / KEY_RE', () => {
  it('is deterministic (content-addressed) and dedups identical bytes', () => {
    expect(assetKey(PNG, 'png')).toBe(assetKey(Buffer.from(PNG), 'png'));
  });
  it('differs for different bytes', () => {
    expect(assetKey(PNG, 'png')).not.toBe(assetKey(JPG, 'jpg'));
  });
  it('produces a sharded key that matches KEY_RE', () => {
    const key = assetKey(PNG, 'png');
    expect(key).toMatch(KEY_RE);
    expect(key.startsWith('images/')).toBe(true);
    // shard dir equals the first two hex chars of the hash
    const [, shard, file] = key.split('/');
    expect(file.startsWith(shard)).toBe(true);
  });
  it('KEY_RE rejects traversal and foreign paths', () => {
    expect(KEY_RE.test('images/ab/../../etc/passwd')).toBe(false);
    expect(KEY_RE.test('../secret.png')).toBe(false);
    expect(KEY_RE.test('images/ab/xyz.png')).toBe(false); // not 64 hex
  });
});

describe('contentTypeForKey', () => {
  it('maps extension → mime', () => {
    expect(contentTypeForKey('images/ab/x.png')).toBe('image/png');
    expect(contentTypeForKey('images/ab/x.jpg')).toBe('image/jpeg');
    expect(contentTypeForKey('images/ab/x.webp')).toBe('image/webp');
    expect(contentTypeForKey('images/ab/x.bin')).toBe('application/octet-stream');
  });
});
