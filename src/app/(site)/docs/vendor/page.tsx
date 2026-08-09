import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { entitlementsOf, isVendor, brandKey } from '@/lib/entitlements';
import { vendorIdForBrand } from '@/lib/vendors';
import { planByKey, countdownLabel } from '@/lib/adPlans';
import { listPublishedReports, parseSnapshot } from '@/lib/reports';
import { testimonialsForVendorDashboard } from '@/lib/testimonials';
import { loadAds } from '@/lib/adsServer';
import { adIsLive } from '@/lib/ads';
import ReportView from '@/components/ReportView';
import VendorAdShowcase from '@/components/site/VendorAdShowcase';
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

  // Resolve the vendor by their brand to the Vendor entity, then load campaigns
  // by FK (indexed). If no Vendor row exists yet (e.g. an account with no
  // campaigns, or pre-backfill data), fall back to the brand-key label match so
  // nothing silently disappears during the transition.
  const vendorId = await vendorIdForBrand(ent.vendorBrand);
  const mine = vendorId
    ? await prisma.adCampaign.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        include: { flights: { orderBy: { index: 'asc' } } },
      })
    : (await prisma.adCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { flights: { orderBy: { index: 'asc' } } },
      })).filter((c) => brandKey(c.vendorName) === brandKey(ent.vendorBrand));

  const now = new Date();
  const current = mine.filter((c) => c.status === 'ACTIVE');
  const past = mine.filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED');
  const reports = vendorId ? await listPublishedReports(vendorId) : [];
  const testimonials = vendorId ? await testimonialsForVendorDashboard(vendorId) : [];

  // This vendor's own live creatives (for the "your ads in the Hub" preview) and
  // the earliest live-flight start (their go-live date for the banner).
  const myAds = (await loadAds()).filter((a) => brandKey(a.brand) === brandKey(ent.vendorBrand) && adIsLive(a, now));
  const liveFlights = current.flatMap((c) => c.flights).filter((f) => f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt);
  const liveSince = liveFlights.length ? liveFlights.map((f) => f.startAt).sort((a, b) => a.getTime() - b.getTime())[0] : null;

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
          : (
            <div className="space-y-4">
              {liveSince && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
                  <p className="font-bold text-green-800 dark:text-green-200">🎉 Your ads are live on RS News Hub</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Live since {formatDate(liveSince)} · published by the RS News team. Preview below shows exactly how they appear to readers.</p>
                </div>
              )}
              {myAds.length > 0 && <VendorAdShowcase ads={myAds} brand={ent.vendorBrand || user.name || 'your brand'} />}
              {current.map((c) => <CampaignCard key={c.id} c={c} now={now} live />)}
              {testimonials.length > 0 && (
                <div className="card p-5">
                  <h2 className="mb-1 font-bold">What stores are saying about you</h2>
                  <p className="mb-3 text-xs text-[var(--muted)]">Testimonials RS News readers left for your brand, curated by our team.</p>
                  <div className="space-y-3">
                    {testimonials.map((t) => (
                      <figure key={t.id} className="tile p-4">
                        <blockquote className="text-sm leading-relaxed">“{t.body}”</blockquote>
                        <figcaption className="mt-2 text-xs font-semibold text-[var(--muted)]">— {t.authorName}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
      )}
      {tab === 'history' && (
        past.length === 0
          ? <Notice title="No past campaigns yet" body="Completed and cancelled campaigns will be listed here." />
          : <div className="space-y-4">{past.map((c) => <CampaignCard key={c.id} c={c} now={now} />)}</div>
      )}
      {tab === 'performance' && (
        reports.length === 0
          ? <Notice title="Performance reports" body="We publish a performance summary for your ads each quarter after review. Your latest report will appear here once it’s ready." />
          : <div className="space-y-4">{reports.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{r.periodLabel}</span>
                  <span className="text-xs text-[var(--muted)]">{formatDate(r.periodStart)} → {formatDate(r.periodEnd)}</span>
                </div>
                {r.summary && <p className="mb-4 whitespace-pre-line text-sm text-[var(--fg)]">{r.summary}</p>}
                <ReportView snapshot={parseSnapshot(r.metrics)} />
              </div>
            ))}</div>
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
              {f.status === 'ENDED' && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Ended</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
