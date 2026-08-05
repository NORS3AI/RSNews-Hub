import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createAdCampaign } from '@/lib/actions';
import { AD_PLANS, planByKey, countdownLabel } from '@/lib/adPlans';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusChip: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-[var(--bg-soft)] text-[var(--muted)]',
  CANCELLED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-amber-100 text-amber-700',
};

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminCampaigns() {
  const campaigns = await prisma.adCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { flights: { orderBy: { index: 'asc' }, include: { _count: { select: { ads: true } } } } },
  });
  const now = new Date();
  const today = toDateInput(now);

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">Ad campaigns</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        A campaign is a vendor&apos;s purchase. Every package runs in <strong>3-month flights</strong> — no creative is ever up longer than one flight, so multi-month packages need fresh ads each flight. Schedule a flight to put its ads live; they come down automatically at the flight&apos;s end.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create */}
        <form action={createAdCampaign} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">New campaign</h2>
          <div><label className="label">Vendor</label><input name="vendorName" required className="input" placeholder="PackWise" /></div>
          <div>
            <label className="label">Package</label>
            <select name="plan" required className="input" defaultValue="quarter">
              {AD_PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}{p.allowsVideo ? ' · video' : ''}</option>)}
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">{AD_PLANS.map((p) => p.description).join(' ')}</p>
          </div>
          <div><label className="label">Start date</label><input name="startAt" type="date" required defaultValue={today} className="input" /></div>
          <div>
            <label className="label">End date <span className="font-normal text-[var(--muted)]">(seasonal/holiday only)</span></label>
            <input name="endAt" type="date" className="input" />
            <p className="mt-1 text-xs text-[var(--muted)]">Leave blank for standard packages (length comes from the package). Set it for a Holiday/Seasonal window.</p>
          </div>
          <div><label className="label">Notes</label><textarea name="notes" className="input min-h-[50px]" placeholder="Internal notes (package details, PO#, …)" /></div>
          <button className="btn-primary w-full">Create campaign</button>
        </form>

        {/* List */}
        <div className="space-y-3 lg:col-span-2">
          {campaigns.length === 0 && <p className="text-[var(--muted)]">No campaigns yet. Create the first on the left.</p>}
          {campaigns.map((c) => {
            const plan = planByKey(c.plan);
            const scheduled = c.flights.filter((f) => f.status === 'SCHEDULED').length;
            const needCreatives = c.flights.filter((f) => f.status === 'AWAITING' || f.status === 'REVIEW').length;
            return (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="card block p-4 transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{c.vendorName}</span>
                  <span className={`badge ${statusChip[c.status] ?? ''}`}>{c.status}</span>
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {plan?.label ?? c.plan}{c.allowsVideo ? ' · video' : ''} · {formatDate(c.startAt)} → {formatDate(c.endAt)}
                  {c.status === 'ACTIVE' && <> · {countdownLabel(c.endAt, now)}</>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="badge bg-[var(--bg-soft)]">{c.flights.length} flight{c.flights.length === 1 ? '' : 's'}</span>
                  {scheduled > 0 && <span className="badge bg-green-100 text-green-700">{scheduled} live/scheduled</span>}
                  {needCreatives > 0 && <span className="badge bg-amber-100 text-amber-700">{needCreatives} need creatives</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
