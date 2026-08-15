// Standard ad creative shapes + the classifier used when importing creatives
// (e.g. from JotForm). We have three on-page slots: a WIDE banner, a chunkier
// RECTANGLE, and a TALL skyscraper (a vertical column ad). Advertisers don't have
// to submit in any particular order — each incoming image is measured and routed
// to the slot its shape fits. Tweak the reference sizes / thresholds here;
// everything downstream reads these.
//
// Reference sizes follow common IAB formats:
//   wide banner → leaderboard / billboard family (e.g. 728×90, 970×250)
//   rectangle   → medium rectangle 300×250 (also fits squares)
//   tall        → skyscraper / half-page family (e.g. 160×600, 300×600)
export const AD_SIZES = {
  wide: { label: 'Wide banner', w: 970, h: 250 },
  rect: { label: 'Rectangle', w: 300, h: 250 },
  tall: { label: 'Skyscraper', w: 160, h: 600 },
} as const;

export type AdShape = 'wide' | 'rect' | 'tall';

// A creative whose width/height ratio is at least this is a wide banner.
// 1.8 cleanly separates a ~3:1 banner from a ~1.2:1 rectangle.
export const WIDE_MIN_RATIO = 1.8;
// A creative at least this much TALLER than wide (w/h at most this) is a
// skyscraper. 0.6 catches 160×600 (0.27) and 300×600 (0.5) while leaving true
// squares (1.0) and 300×400-ish portraits (0.75) in the rectangle slot.
export const TALL_MAX_RATIO = 0.6;

/** Route a creative to a slot by its measured shape. Unknown dims → rectangle. */
export function classifyShape(width?: number | null, height?: number | null): AdShape {
  if (!width || !height || width <= 0 || height <= 0) return 'rect';
  const ratio = width / height;
  if (ratio >= WIDE_MIN_RATIO) return 'wide';
  if (ratio <= TALL_MAX_RATIO) return 'tall';
  return 'rect';
}

/**
 * Pair a list of shaped creatives into ads. Each ad can fill a wide slot, a
 * rectangle slot, and/or a tall slot; a submission with one banner + one
 * rectangle becomes a single multi-slot ad. Same-shape extras pair up by order
 * (the only place submission order matters), and leftovers become single-slot
 * ads. Never duplicates one image into another slot.
 */
export function pairCreatives(creatives: { url: string; shape: AdShape }[]): { imageWide: string | null; imageRect: string | null; imageTall: string | null }[] {
  const wides = creatives.filter((c) => c.shape === 'wide').map((c) => c.url);
  const rects = creatives.filter((c) => c.shape === 'rect').map((c) => c.url);
  const talls = creatives.filter((c) => c.shape === 'tall').map((c) => c.url);
  const out: { imageWide: string | null; imageRect: string | null; imageTall: string | null }[] = [];
  const n = Math.max(wides.length, rects.length, talls.length);
  for (let i = 0; i < n; i++) {
    const imageWide = wides[i] ?? null;
    const imageRect = rects[i] ?? null;
    const imageTall = talls[i] ?? null;
    if (imageWide || imageRect || imageTall) out.push({ imageWide, imageRect, imageTall });
  }
  return out;
}
