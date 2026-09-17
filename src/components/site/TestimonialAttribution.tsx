import { formatDate } from '@/lib/utils';

// Shared "— Store · Person · CODE · date" byline for a testimonial, so the admin
// review list, the vendor dashboard card, and the downloadable document all read
// the same. `memberCode` is IN-HOUSE ONLY — pass it only on admin surfaces, never
// on anything an advertiser sees.
export default function TestimonialAttribution({
  storeName, authorName, memberCode, date,
}: { storeName: string | null; authorName: string; memberCode?: string | null; date?: Date }) {
  return (
    <>
      {storeName ? <><span className="font-semibold text-[var(--fg)]">{storeName}</span> · </> : ''}{authorName}
      {memberCode ? <> · <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-[10px]" title="Member ID — in-house only, not shown to advertisers">{memberCode}</span></> : null}
      {date ? <> · {formatDate(date)}</> : null}
    </>
  );
}
