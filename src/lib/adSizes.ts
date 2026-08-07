// Standard ad creative shapes + the classifier used when importing creatives
// (e.g. from JotForm). We have two on-page slots: a WIDE banner and a chunkier
// RECTANGLE. Advertisers don't have to submit in any particular order — each
// incoming image is measured and routed to the slot its shape fits. Tweak the
// reference sizes / threshold here; everything downstream reads these.
//
// Reference sizes follow common IAB formats:
//   wide banner → leaderboard / billboard family (e.g. 728×90, 970×250)
//   rectangle   → medium rectangle 300×250 (also fits squares)
export const AD_SIZES = {
  wide: { label: 'Wide banner', w: 970, h: 250 },
  rect: { label: 'Rectangle', w: 300, h: 250 },
} as const;

export type AdShape = 'wide' | 'rect';

// A creative whose width/height ratio is at least this is treated as a wide
// banner; anything squarer (including true squares and portraits) is a
// rectangle. 1.8 cleanly separates a ~3:1 banner from a ~1.2:1 rectangle.
export const WIDE_MIN_RATIO = 1.8;

/** Route a creative to a slot by its measured shape. Unknown dims → rectangle. */
export function classifyShape(width?: number | null, height?: number | null): AdShape {
  if (!width || !height || width <= 0 || height <= 0) return 'rect';
  return width / height >= WIDE_MIN_RATIO ? 'wide' : 'rect';
}

/**
 * Pair a list of shaped creatives into ads. Each ad fills a wide slot and/or a
 * rectangle slot; a submission with one banner + one rectangle becomes a single
 * two-slot ad. Same-shape extras pair up by order (the only place submission
 * order matters), and leftovers become single-slot ads. Never duplicates one
 * image into both slots.
 */
export function pairCreatives(creatives: { url: string; shape: AdShape }[]): { imageWide: string | null; imageRect: string | null }[] {
  const wides = creatives.filter((c) => c.shape === 'wide').map((c) => c.url);
  const rects = creatives.filter((c) => c.shape === 'rect').map((c) => c.url);
  const out: { imageWide: string | null; imageRect: string | null }[] = [];
  const n = Math.max(wides.length, rects.length);
  for (let i = 0; i < n; i++) {
    const imageWide = wides[i] ?? null;
    const imageRect = rects[i] ?? null;
    if (imageWide || imageRect) out.push({ imageWide, imageRect });
  }
  return out;
}
