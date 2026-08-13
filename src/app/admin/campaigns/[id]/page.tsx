import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { assignFlightAds, scheduleAdFlight, pauseAdFlight, cancelAdCampaign, markAdCampaignPaid } from '@/lib/actions';
import { planByKey, countdownLabel } from '@/lib/adPlans';
import { isPaid, paidTotalCents } from '@/lib/payments';
import { ActionButtons } from '@/components/admin/RowActions';
import { formatDate } from '@/lib/utils';

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

export const dynamic = 'force-dynamic';

const flightChip: Record<string, string> = {
  SCHEDULED: 'bg-green-100 text-green-700',
  REVIEW: 'bg-amber-100 text-amber-700',
  AWAITING: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  ENDED: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.adCampaign.findUnique({
    where: { id },
    include: { flights: { orderBy: { index: 'asc' }, include: { ads: true } }, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!campaign) notFound();

  const paid = isPaid(campaign.payments);
  const paidLabel = paid ? money(paidTotalCents(campaign.payments), campaign.payments.find((p) => p.status === 'PAID')?.currency ?? 'usd') : null;

  // Ads not yet attached to any flight — the pool the admin assigns from.
  const unassigned = await prisma.ad.findMany({ where: { flightId: null, reserved: false }, orderBy: { createdAt: 'desc' }, select: { id: true, brand: true, headline: true, video: true } });
  const now = new Date();
  const plan = planByKey(campaign.plan);
  const isOver = campaign.status === 'CANCELLED' || campaign.status === 'COMPLETED';

  return (
    <div className="max-w-4xl">
      <Link href="/admin/campaigns" className="mb-4 inline-block text-sm text-brand-600 hover:underline">← All campaigns</Link>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{campaign.vendorName}</h1>
        <div className="flex items-center gap-2">
          <span className={`badge ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{paid ? `Payment confirmed${paidLabel ? ` · ${paidLabel}` : ''}` : 'Payment not confirmed'}</span>
          <span className="badge">{campaign.status}</span>
        </div>
      </div>
      <p className="mb-1 text-sm text-[var(--muted)]">
        {plan?.label ?? campaign.plan}{campaign.allowsVideo ? ' · video allowed' : ''} · {formatDate(campaign.startAt)} → {formatDate(campaign.endAt)}
        {campaign.status === 'ACTIVE' && <> · {countdownLabel(campaign.endAt, now)}</>}
        {campaign.notes ? <> · {campaign.notes}</> : null}
      </p>
      {/* Who placed THIS order — archived with the order (each order can be a
          different person). This is who go-live + reminder emails address. */}
      {(campaign.contactName || campaign.contactEmail) && (
        <p className="mb-5 text-sm text-[var(--muted)]">
          Ordered by <span className="font-semibold text-[var(--fg)]">{campaign.contactName || 'Unknown'}</span>
          {campaign.contactEmail && <> · <a href={`mailto:${campaign.contactEmail}`} className="text-brand-600 hover:underline">{campaign.contactEmail}</a></>}
        </p>
      )}
      {!campaign.contactName && !campaign.contactEmail && <div className="mb-5" />}

      {!isOver && !paid && (
        <div className="card mb-5 border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Payment isn’t confirmed — flights can’t go live until it is.</p>
          <p className="mb-3 text-xs text-red-700">Paying happens on JotForm, not here. JotForm confirms this automatically when the vendor pays; otherwise confirm it here (e.g. comped, or you verified the payment landed). The amount is just for your records.</p>
          <form action={markAdCampaignPaid} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="campaignId" value={campaign.id} />
            <div>
              <label className="label text-xs">Amount (optional)</label>
              <input name="amount" className="input h-9 w-32" placeholder="$300.00" />
            </div>
            <div className="min-w-40 flex-1">
              <label className="label text-xs">Note (optional)</label>
              <input name="note" className="input h-9" placeholder="PO#, comped, verified in JotForm…" />
            </div>
            <button className="btn-primary btn-sm">Confirm payment</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {campaign.flights.map((f) => {
          const live = f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt;
          return (
            <div key={f.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">
                  Flight {f.index}
                  <span className="ml-2 text-sm font-normal text-[var(--muted)]">{formatDate(f.startAt)} → {formatDate(f.endAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {live && <span className="badge bg-green-100 text-green-700">LIVE · {countdownLabel(f.endAt, now)}</span>}
                  <span className={`badge ${flightChip[f.status] ?? ''}`}>{f.status}</span>
                </div>
              </div>

              {/* Assigned creatives */}
              <div className="mt-3">
                {f.ads.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No creatives yet — this flight needs fresh ads before it can go live.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {f.ads.map((a) => (
                      <li key={a.id} className="flex items-center gap-2">
                        <span className="badge bg-[var(--bg-soft)] text-[10px]">{a.video ? 'VIDEO' : 'IMAGE'}</span>
                        <span className="font-medium">{a.brand}</span>
                        <span className="truncate text-[var(--muted)]">{a.headline}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Controls */}
              {!isOver && f.status !== 'ENDED' && (
                <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                  {unassigned.length > 0 && (
                    <form action={assignFlightAds} className="space-y-2">
                      <input type="hidden" name="flightId" value={f.id} />
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <div className="text-xs font-semibold text-[var(--muted)]">Assign creatives (make new ones in <Link href="/admin/ads" className="text-brand-600 hover:underline">Ad management</Link>):</div>
                      <div className="flex flex-wrap gap-2">
                        {unassigned.map((a) => (
                          <label key={a.id} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 text-xs">
                            <input type="checkbox" name="adIds" value={a.id} className="h-3.5 w-3.5" />
                            {a.brand}{a.video ? ' (video)' : ''}
                          </label>
                        ))}
                      </div>
                      <button className="btn-outline btn-sm">Assign selected</button>
                    </form>
                  )}
                  <ActionButtons actions={[
                    f.status === 'SCHEDULED'
                      ? { label: 'Pause', run: pauseAdFlight.bind(null, campaign.id, f.id) }
                      : { label: 'Schedule (Go)', run: scheduleAdFlight.bind(null, campaign.id, f.id) },
                  ]} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isOver && (
        <div className="mt-6">
          <ActionButtons actions={[{ label: 'Cancel campaign', run: cancelAdCampaign.bind(null, campaign.id), danger: true, confirm: `Cancel ${campaign.vendorName}'s campaign? All its ads stop serving.` }]} />
        </div>
      )}
    </div>
  );
}
