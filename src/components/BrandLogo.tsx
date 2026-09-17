// The RS News Hub brand marks (see /public/brand). Three assets:
//   • icon    — the 2×2 tile mark; has its own coloured tiles, so it reads on
//                any background. Used as the compact badge in headers + favicon.
//   • lockup  — the full stacked wordmark. Two colourways: dark ink text for
//                LIGHT surfaces, white text for DARK surfaces. `variant="auto"`
//                renders both and swaps on the theme (`.dark`) so it's always legible.

import Image from 'next/image';

const ICON = { src: '/brand/rsnews-hub-icon.png', w: 415, h: 331 };
const LIGHT = { src: '/brand/rsnews-hub-logo-light.png', w: 412, h: 347 };
const DARK = { src: '/brand/rsnews-hub-logo-dark.png', w: 412, h: 347 };

/** The compact 2×2 icon mark. Give it a pixel height; width follows the ratio. */
export function BrandMark({ size = 36, className = '', priority = false, alt = 'RS News Hub' }: { size?: number; className?: string; priority?: boolean; alt?: string }) {
  return (
    <Image src={ICON.src} alt={alt} width={Math.round((size * ICON.w) / ICON.h)} height={size}
      priority={priority} className={className} style={{ height: size, width: 'auto' }} />
  );
}

/** The full stacked lockup. `variant`:
 *  - 'auto'  (default) theme-aware: dark-ink on light, white on dark
 *  - 'light' dark-ink wordmark (for known-light surfaces)
 *  - 'dark'  white wordmark (for known-dark surfaces) */
export function BrandLockup({
  height = 96, variant = 'auto', className = '', priority = false,
}: { height?: number; variant?: 'auto' | 'light' | 'dark'; className?: string; priority?: boolean }) {
  const w = (a: typeof LIGHT) => Math.round((height * a.w) / a.h);
  const common = (a: typeof LIGHT) => ({ src: a.src, width: w(a), height, priority, style: { height, width: 'auto' as const } });
  const ALT = 'RS News Hub';

  if (variant === 'light') return <Image {...common(LIGHT)} alt={ALT} className={className} />;
  if (variant === 'dark') return <Image {...common(DARK)} alt={ALT} className={className} />;
  return (
    <>
      <Image {...common(LIGHT)} alt={ALT} className={`block dark:hidden ${className}`} />
      <Image {...common(DARK)} alt={ALT} className={`hidden dark:block ${className}`} />
    </>
  );
}
