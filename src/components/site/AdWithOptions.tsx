import type { AdRow } from '@/lib/ads';
import type { SupplierAdInfo } from '@/lib/suppliers';
import { brandKey } from '@/lib/entitlements';
import InArticleAd from '@/components/InArticleAd';
import AdOptionsMenu from '@/components/site/AdOptionsMenu';

/**
 * An ad creative plus its "options" overlay. The ad renders exactly as before
 * (a direct link to the advertiser — the main click is unchanged); when the ad's
 * brand is a premium supplier we add a small ⋯ button in the corner that opens
 * the supplier-page / website / save-to-phone-book menu. The button is a sibling
 * of the ad's anchor (never nested inside it), so it can't hijack the direct click.
 */
export default function AdWithOptions({
  ad, suppliers, savedIds, signedIn, slot, size = 'in-article', tone = 'card', fill = false, placeholder = true,
}: {
  ad: AdRow | null;
  suppliers: Map<string, SupplierAdInfo>;
  savedIds: string[];
  signedIn: boolean;
  slot?: string;
  size?: 'in-article' | 'rectangle';
  tone?: 'card' | 'orange';
  fill?: boolean;
  // `placeholder=false` collapses to nothing when there's no image creative
  // (live homepage) so a reader never sees an empty/filler ad box.
  placeholder?: boolean;
}) {
  const info = ad ? suppliers.get(brandKey(ad.brand)) : undefined;
  if (!ad || !info) {
    return <InArticleAd ad={ad} slot={slot} size={size} tone={tone} fill={fill} placeholder={placeholder} />;
  }
  // A centered rectangle (no `fill`) is capped narrower than its column, so the
  // wrapper must hug the ad — otherwise the ⋯ button floats at the column edge.
  const wrap = size === 'rectangle' && !fill ? 'relative mx-auto w-fit max-w-full' : 'relative w-full';
  return (
    <div className={wrap}>
      <InArticleAd ad={ad} slot={slot} size={size} tone={tone} fill={fill} placeholder={placeholder} />
      <AdOptionsMenu
        supplierUrl={info.supplierUrl}
        website={info.website || ad.href}
        vendorId={info.vendorId}
        saved={savedIds.includes(info.vendorId)}
        signedIn={signedIn}
      />
    </div>
  );
}
