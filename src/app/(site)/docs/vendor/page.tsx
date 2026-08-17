import Link from 'next/link';
import { brandKey } from '@/lib/entitlements';
import { getVendorDashboardData } from '@/lib/vendorData';
import { planByKey, countdownLabel } from '@/lib/adPlans';
import { parseSnapshot } from '@/lib/reports';
import { REPORT_PERIODS } from '@/lib/vendorReports';
import TestimonialAttribution from '@/components/site/TestimonialAttribution';
import RequestReportForm from '@/components/site/RequestReportForm';
import VendorReviewInbox from '@/components/site/VendorReviewInbox';
import { AdPreviewButton } from '@/components/site/AdPreview';
import ReportView from '@/components/ReportView';
import { formatDate, formatDateUTC } from '@/lib/utils';
import { ExternalLink, Megaphone, Check, X, Sparkles } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function VendorDashboard(props: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await props.searchParams;
  const data = await getVendorDashboardData(tabParam);
  if (data.kind === 'signedout') return <Shell><Notice title="Sign in to view your vendor dashboard" body="Log in on the main RS News site to see your ad campaigns." /></Shell>;
  if (data.kind === 'notvendor') return <Shell><Notice title="This area is for advertisers" body="Your account isn’t set up as a vendor. If you advertise with RS News and this looks wrong, contact us." /></Shell>;
  if (data.kind === 'inactive') return <Shell><Notice title="Premium supplier dashboard unavailable" body="The advertiser dashboard is available to active premium suppliers only. If you believe this is a mistake, please contact the RS News team." /></Shell>;
  const {
    user, ent, mine, now, current, past,
    reports, testimonials, updateUrl, latestReq, articleReviews,
    pendingReviews, TAB_LIST, tab,
    creatives, coverage, liveSince,
    reqDisabled, reqNote,
  } = data;

  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--border)] bg-gradient-to-br from-brand-600/10 to-transparent p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><Megaphone width={22} height={22} /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black leading-tight">Your dashboard</h1>
              <p className="text-sm text-[var(--muted)]"><span className="font-semibold text-[var(--fg)]">{ent.vendorBrand || user.name}</span> · {mine.length} campaign{mine.length === 1 ? '' : 's'} on record</p>
            </div>
          </div>
          <div className="mt-5 inline-flex flex-wrap gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
            {TAB_LIST.map(([key, label]) => (
              <Link key={key} href={`/docs/vendor?tab=${key}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${tab === key ? 'bg-brand-600 text-white shadow-sm' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
                {label}
                {key === 'reviews' && pendingReviews > 0 && (
                  <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-black ${tab === key ? 'bg-white/25 text-white' : 'bg-amber-400 text-amber-950'}`}>{pendingReviews}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {tab === 'reviews' && (
          <div className="p-5 sm:p-6">
            <VendorReviewInbox reviews={articleReviews} />
          </div>
        )}

        {tab === 'current' && (
          <div className="divide-y divide-[var(--border)]">
                {liveSince && (
                  <div className="p-5 sm:p-6">
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/30">
                      <p className="flex items-center gap-1.5 font-bold text-green-800 dark:text-green-200"><Sparkles width={16} height={16} className="shrink-0" /> Your ads are live on RS News Hub</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Live since {formatDate(liveSince)}, published by the RS News team.</p>
                    </div>
                  </div>
                )}

                {/* View your current ads — shown whenever creatives exist, even
                    between campaigns, so the vendor can always preview + see coverage. */}
                {creatives.length > 0 && (
                <section className="p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-black">View your current ads</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdPreviewButton brandKey={brandKey(ent.vendorBrand)} />
                      {updateUrl
                        ? <a href={updateUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Update your ads <ExternalLink width={13} height={13} /></a>
                        : <span className="text-xs text-[var(--muted)]">To refresh your creatives, contact the RS News team.</span>}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {creatives.map((c) => (
                      <div key={c.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-2)]">
                        <div className="border-b border-[var(--border)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{c.shape}</div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.img} alt={`${c.brand} ${c.shape} ad`} className="block w-full" />
                      </div>
                    ))}
                  </div>

                  {/* Coverage checklist — what slot shapes they can fill, and the
                      ones they're missing (an upsell hint, not a control). */}
                  <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Where your ads can appear</div>
                    <ul className="space-y-2">
                      {coverage.map((c) => (
                        <li key={c.label} className="flex items-start gap-2.5 text-sm">
                          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.has ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-[var(--bg-soft)] text-[var(--muted)]'}`}>
                            {c.has ? <Check width={13} height={13} /> : <X width={13} height={13} />}
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold text-[var(--fg)]">{c.label}</span>
                            <span className="text-[var(--muted)]"> — {c.where}</span>
                            {!c.has && <span className="block text-xs font-semibold text-brand-600">You don&apos;t have this creative yet — a spot you could fill.</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
                )}

                {/* Current campaign(s), or a note when none are live. */}
                {current.length === 0
                  ? <div className="p-5 sm:p-6"><Notice title="No live campaigns" body="When a campaign of yours is active, it shows here with its timeline. Any creatives on file are shown above." /></div>
                  : current.map((c) => <CampaignSection key={c.id} c={c} now={now} />)}

                {/* Testimonials */}
                {testimonials.length > 0 && (
                  <section className="p-5 sm:p-6">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-black">What stores are saying about you</h2>
                      <Link href="/vendor-testimonials" target="_blank" className="btn-primary btn-sm">View &amp; download</Link>
                    </div>
                    <p className="mb-3 text-xs text-[var(--muted)]">{testimonials.length} testimonial{testimonials.length === 1 ? '' : 's'} RS News readers left for your brand, curated by our team.</p>
                    <div className="space-y-3">
                      {testimonials.slice(0, 3).map((t) => (
                        <figure key={t.id} className="tile p-4">
                          <blockquote className="text-sm leading-relaxed">“{t.body}”</blockquote>
                          <figcaption className="mt-2 text-xs font-semibold text-[var(--muted)]">— <TestimonialAttribution storeName={t.storeName} authorName={t.authorName} /></figcaption>
                        </figure>
                      ))}
                    </div>
                  </section>
                )}
              </div>
        )}

        {tab === 'performance' && (
          <div className="divide-y divide-[var(--border)]">
            <section className="p-5 sm:p-6">
              <h2 className="text-lg font-black">Request a performance report</h2>
              <p className="mb-3 mt-0.5 text-sm text-[var(--muted)]">Ask us to compile how your ads performed over a period — we’ll put it together and send it to you.</p>
              <RequestReportForm disabled={reqDisabled} disabledNote={reqNote} />
              {latestReq && (
                <p className="mt-2 text-xs text-[var(--muted)]">Last request: {REPORT_PERIODS[latestReq.period]?.label ?? latestReq.period} · {latestReq.status === 'FULFILLED' ? `sent ${latestReq.fulfilledAt ? formatDate(latestReq.fulfilledAt) : ''}` : 'pending'}</p>
              )}
            </section>
            <section className="p-5 sm:p-6">
              <h2 className="mb-3 text-lg font-black">Published reports</h2>
              {reports.length === 0
                ? <p className="text-sm text-[var(--muted)]">No reports yet — request one above, or we’ll publish your quarterly summary here after review.</p>
                : <div className="space-y-4">{reports.map((r) => (
                    <div key={r.id} className="tile p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold">{r.periodLabel}</span>
                        <span className="text-xs text-[var(--muted)]">{formatDateUTC(r.periodStart)} → {formatDateUTC(r.periodEnd)}</span>
                      </div>
                      {r.summary && <p className="mb-4 whitespace-pre-line text-sm text-[var(--fg)]">{r.summary}</p>}
                      <ReportView snapshot={parseSnapshot(r.metrics)} />
                    </div>
                  ))}</div>}
            </section>
          </div>
        )}

        {tab === 'history' && (
          <div className="p-5 sm:p-6">
            {past.length === 0
              ? <Notice title="No past campaigns yet" body="Completed and cancelled campaigns will be listed here." />
              : <div className="divide-y divide-[var(--border)]">{past.map((c) => <CampaignSection key={c.id} c={c} now={now} past />)}</div>}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-page py-8 sm:py-10"><div className="mx-auto max-w-3xl">{children}</div></div>;
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

type CampaignWithFlights = { id: string; vendorName: string; plan: string; startAt: Date; endAt: Date; status: string; allowsVideo: boolean; flights: { id: string; index: number; startAt: Date; endAt: Date; status: string }[] };

function CampaignSection({ c, now, past = false }: { c: CampaignWithFlights; now: Date; past?: boolean }) {
  const plan = planByKey(c.plan);
  const planLabel = `${plan?.label ?? c.plan}${c.allowsVideo ? ' · video' : ''}`;
  // Roughly, when fresh ads are next needed: the next flight awaiting creatives,
  // else the end of the currently-live flight.
  const nextDue = c.flights.find((f) => (f.status === 'AWAITING' || f.status === 'REVIEW') && now < f.startAt)?.startAt
    ?? c.flights.find((f) => f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt)?.endAt
    ?? null;
  return (
    <section className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">{past ? planLabel : `Current campaign · ${planLabel}`}</h2>
        <span className="badge bg-[var(--bg-soft)]">{c.status}{!past ? ` · ${countdownLabel(c.endAt, now)}` : ''}</span>
      </div>
      <div className="mt-0.5 text-sm text-[var(--muted)]">{formatDate(c.startAt)} → {formatDate(c.endAt)}</div>
      {!past && nextDue && <div className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-300">Next fresh ads due around {formatDate(nextDue)}</div>}
      <ul className="mt-3 space-y-1.5">
        {c.flights.map((f) => {
          const isLive = f.status === 'SCHEDULED' && now >= f.startAt && now < f.endAt;
          const upcoming = f.status !== 'ENDED' && now < f.startAt;
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-20 shrink-0 font-semibold">Batch {f.index}</span>
              <span className="text-[var(--muted)]">{formatDate(f.startAt)} → {formatDate(f.endAt)}</span>
              {isLive && <span className="badge bg-green-100 text-green-700">Live · {countdownLabel(f.endAt, now)}</span>}
              {upcoming && f.status === 'SCHEDULED' && <span className="badge bg-blue-100 text-blue-700">Starts {formatDate(f.startAt)}</span>}
              {(f.status === 'AWAITING' || f.status === 'REVIEW') && upcoming && <span className="badge bg-amber-100 text-amber-700">Fresh ads needed</span>}
              {f.status === 'ENDED' && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Ended</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
