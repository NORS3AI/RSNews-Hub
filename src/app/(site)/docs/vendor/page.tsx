import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { entitlementsOf, isVendor, brandKey } from '@/lib/entitlements';
import { planByKey, countdownLabel } from '@/lib/adPlans';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TABS = [['current', 'Current'], ['history', 'History'], ['performance', 'Performance']] as const;

export default async function VendorDashboard(props: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await props.searchParams;
  const tab = TABS.some((t) => t[0] === tabParam) ? tabParam! : 'current';
  const user = await getCurrentUser();
  const ent = entitlementsOf(user ?? {});

  if (!user) {
    return <Shell><Notice title="Sign in to view your vendor dashboard" body="Log in on the main RS News site to see your ad campaigns." /></Shell>;
  }
  if (!isVendor(ent)) {
    return <Shell><Notice title="This area is for advertisers" body="Your account isn’t set up as a vendor. If you advertise with RS News and this looks wrong, contact us." /></Shell>;
  }

  // Match this vendor's campaigns by brand (case-insensitive). Volume is low, so
  // filter in app; a vendor↔brand FK can replace this at scale.
  const mine = (await prisma.adCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { flights: { orderBy: { index: 'asc' } } },
  })).filter((c) => brandKey(c.vendorName) === brandKey(ent.vendorBrand));

  const now = new Date();
  const current = mine.filter((c) => c.status === 'ACTIVE');
  const past = mine.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED');

  return (
    <Shell>
      <div className="card p-5 sm:p-6">
        <h1 className="text-2xl font-bold">Your ad dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{ent.vendorBrand || user.name} · {mine.length} campaign{mine.length === 1 ? '' : 's'} on record</p>
      </div>

      <div className="mt-5 mb-6 inline-flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/docs/vendor?tab=${key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === key ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === 'current' && (
        current.length === 0
          ? <Notice title="No live campaigns" body="When a campaign of yours is active, its flights and countdowns show here." />
          : <div className="space-y-4">{current.map((c) => <CampaignCard key={c.id} c={c} now={now} live />)}</div>
      )}
      {tab === 'history' && (
        past.length === 0
          ? <Notice title="No past campaigns yet" body="Completed and cancelled campaigns will be listed here." />
          : <div className="space-y-4">{past.map((c) => <CampaignCard key={c.id} c={c} now={now} />)}</div>
      )}
      {tab === 'performance' && (
        <Notice title="Performance reports" body="We publish a performance summary for your ads each quarter after review. Your latest report will appear here once it’s ready." />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-page py-8 sm:py-10"><div className="mx-auto max-w-3xl">{children}</div></div>;
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

type CampaignWithFlights = { id: string; vendorName: string; plan: string; startAt: Date; endAt: Date; status: string; allowsVideo: boolean; flights: { id: string; index: number; startAt: Date; endAt: Date; status: string }[] };

function CampaignCard({ c, now, live = false }: { c: CampaignWithFlights; now: Date; live?: boolean }) {
  const plan = planByKey(c.plan);
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">{plan?.label ?? c.plan}{c.allowsVideo ? ' · video' : ''}</span>
        <span className="badge bg-[var(--bg-soft)]">{c.status}{live ? ` · ${countdownLabel(c.endAt, now)}` : ''}</span>
      </div>
      <div className="mt-0.5 text-sm text-[var(--muted)]">{formatDate(c.startAt)} → {formatDate(c.endAt)}</div>
      <ul className="mt-3 space-y-1.5">
        {c.flights.map((f) => {
          const isLive = f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt;
          const upcoming = f.status !== 'ENDED' && now < f.startAt;
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-16 shrink-0 font-semibold">Flight {f.index}</span>
              <span className="text-[var(--muted)]">{formatDate(f.startAt)} → {formatDate(f.endAt)}</span>
              {isLive && <span className="badge bg-green-100 text-green-700">Live · {countdownLabel(f.endAt, now)}</span>}
              {upcoming && f.status === 'SCHEDULED' && <span className="badge bg-blue-100 text-blue-700">Starts {formatDate(f.startAt)}</span>}
              {(f.status === 'AWAITING' || f.status === 'REVIEW') && upcoming && <span className="badge bg-amber-100 text-amber-700">Fresh ads needed</span>}
              {f.status === 'ENDED' && <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Ended</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
