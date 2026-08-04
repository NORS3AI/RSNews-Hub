import Link from 'next/link';
import { loadEvents, totalEventCount, loadUserInfo } from '@/lib/analytics/query';
import { aggregateAds, aggregateEngagement, aggregateReading, aggregateClips, aggregateOverview, aggregateVideo, ctr } from '@/lib/analytics/metrics';
import { aggregateAudience, AUDIENCE_DIMS, type AudienceDim } from '@/lib/analytics/audience';
import { loadDailySeries, retentionDays } from '@/lib/analytics/rollup';
import { rebuildAnalyticsRollups } from '@/lib/actions';
import ReportTable from '@/components/admin/ReportTable';
import Sparkline from '@/components/admin/Sparkline';

export const dynamic = 'force-dynamic';

const DAYS = [7, 30, 90];
const AD_SPLITS = [['placement', 'Placement'], ['format', 'Format'], ['shape', 'Shape'], ['campaign', 'Campaign'], ['creative', 'Creative'], ['pageType', 'Page type']] as const;
const VID_SPLITS = [['creative', 'Creative'], ['campaign', 'Campaign'], ['placement', 'Placement']] as const;
const ART_SPLITS = [['module', 'Module'], ['hasImage', 'Image vs none'], ['moduleType', 'Module type'], ['position', 'Position'], ['pageType', 'Page type']] as const;

function fmtMs(ms: number) {
  if (ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
const pctStr = (n: number) => `${Math.round(n * 100)}%`;
const nf = (n: number) => n.toLocaleString();

export default async function AnalyticsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const days = DAYS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const adSplit = AD_SPLITS.some((s) => s[0] === searchParams.adSplit) ? searchParams.adSplit! : 'placement';
  const artSplit = ART_SPLITS.some((s) => s[0] === searchParams.artSplit) ? searchParams.artSplit! : 'module';
  const audSplit = (AUDIENCE_DIMS.some((s) => s[0] === searchParams.audSplit) ? searchParams.audSplit! : 'accountType') as AudienceDim;
  const audLabel = (AUDIENCE_DIMS.find((s) => s[0] === audSplit) ?? (['', 'Account type'] as const))[1];
  const vidSplit = VID_SPLITS.some((s) => s[0] === searchParams.vidSplit) ? searchParams.vidSplit! : 'creative';
  const vidLabel = (VID_SPLITS.find((s) => s[0] === vidSplit) ?? (['', 'Creative'] as const))[1];

  const adLabel = (AD_SPLITS.find((s) => s[0] === adSplit) ?? (['', 'Placement'] as const))[1];
  const artLabel = (ART_SPLITS.find((s) => s[0] === artSplit) ?? (['', 'Module'] as const))[1];

  const [{ events, capped }, total, series] = await Promise.all([loadEvents(days), totalEventCount(), loadDailySeries(new Date(), days)]);
  const ov = aggregateOverview(events);

  // Trend series from the daily rollups (survives raw-event pruning).
  const sum = (pick: (d: (typeof series)[number]) => number) => series.reduce((a, d) => a + pick(d), 0);
  const trend = {
    pageviews: series.map((d) => d.pageviews),
    visitors: series.map((d) => d.visitors),
    opens: series.map((d) => d.articleOpens),
    ctr: series.map((d) => Math.round(ctr(d.adClicks, d.adViewable || d.adImpressions) * 1000) / 10),
  };
  const totals = { pageviews: sum((d) => d.pageviews), opens: sum((d) => d.articleOpens), clk: sum((d) => d.adClicks), view: sum((d) => d.adViewable), imp: sum((d) => d.adImpressions) };
  const avgVisitors = series.length ? Math.round(sum((d) => d.visitors) / series.length) : 0;
  const hasTrend = series.some((d) => d.events > 0);
  const ads = aggregateAds(events, adSplit);
  const eng = aggregateEngagement(events, artSplit);
  const reading = aggregateReading(events);
  const clips = aggregateClips(events);
  const userInfo = await loadUserInfo(events, new Date());
  const audience = aggregateAudience(events, audSplit, userInfo);
  const video = aggregateVideo(events, vidSplit);

  const url = (p: Record<string, string | number>) => {
    const q = new URLSearchParams({ days: String(days), adSplit, artSplit, audSplit, vidSplit, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) });
    return `/admin/analytics?${q.toString()}`;
  };

  const empty = events.length === 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="inline-flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-0.5">
          {DAYS.map((d) => (
            <Link key={d} href={url({ days: d })} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${days === d ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
              {d}d
            </Link>
          ))}
        </div>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        Every number reads in three layers: <strong className="text-[var(--fg)]">Exposure</strong> (was it actually seen — viewable, above-fold, dwell), <strong className="text-[var(--fg)]">Interaction</strong> (clicked / opened / saved), and <strong className="text-[var(--fg)]">Outcome</strong> (read, kept exploring). Use the <em>Compare by</em> buttons to split a table and see what really drove a result — a design, a placement, or just being higher on the page.
      </p>

      {/* ---------- Trends (from daily rollups) ---------- */}
      <section className="mb-8">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Trends — last {days} days</SectionTitle>
          <form action={rebuildAnalyticsRollups}>
            <button className="btn-outline btn-sm" title="Recompute the daily rollups from raw events now">Rebuild rollups</button>
          </form>
        </div>
        {hasTrend ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Sparkline label="Pageviews" value={nf(totals.pageviews)} points={trend.pageviews} sub={`${nf(totals.pageviews)} in ${days}d`} />
            <Sparkline label="Visitors / day" value={nf(avgVisitors)} points={trend.visitors} sub="avg per day" />
            <Sparkline label="Article opens" value={nf(totals.opens)} points={trend.opens} sub={`${nf(totals.opens)} in ${days}d`} />
            <Sparkline label="Ad CTR" value={pctStr(ctr(totals.clk, totals.view || totals.imp))} points={trend.ctr} sub="clicks ÷ viewable" />
          </div>
        ) : (
          <div className="card p-5 text-sm text-[var(--muted)]">
            No rollups yet for this window. Rollups are built nightly (or click <strong>Rebuild rollups</strong>). They power these trends and let old raw events be pruned without losing history.
          </div>
        )}
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Daily rollups preserve history so raw events can be pruned. Retention: {retentionDays() > 0 ? <><strong>{retentionDays()} days</strong> of raw events</> : <strong>pruning disabled</strong>}. Automate with a nightly <code>POST /api/analytics/rollup</code> (see DEPLOYMENT.md).
        </p>
      </section>

      {empty ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No analytics yet for this window.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Events are collected on the live site as people browse. Visit the public pages (home, an article, clippings) to generate some, or widen the date range. {total > 0 ? `There are ${nf(total)} total events on record.` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ---------- Overview ---------- */}
          <section>
            <SectionTitle>Hub overview</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Visitors" value={nf(ov.visitors)} />
              <Tile label="Sessions" value={nf(ov.sessions)} />
              <Tile label="Pageviews" value={nf(ov.pageviews)} />
              <Tile label="Article opens" value={nf(ov.articleOpens)} />
              <Tile label="Opens / session" value={String(ov.opensPerSession)} />
              <Tile label="Signed-in" value={nf(ov.loggedInVisitors)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <BarList title="By device" rows={ov.byDevice} />
              <BarList title="By page" rows={ov.byPage} />
            </div>
          </section>

          {/* ---------- Audience segmentation ---------- */}
          <section>
            <SectionTitle>Audience — who is engaging</SectionTitle>
            <Compare current={audSplit} options={AUDIENCE_DIMS as unknown as [string, string][]} makeHref={(v) => url({ audSplit: v })} />
            <ReportTable
              columns={[{ key: 'key', label: audLabel }, { key: 'visitors', label: 'Visitors', type: 'int' }, { key: 'sessions', label: 'Sessions', type: 'int' }, { key: 'pageviews', label: 'Pageviews', type: 'int' }, { key: 'articleOpens', label: 'Opens', type: 'int' }, { key: 'opensPerSession', label: 'Opens/session', type: 'num' }]}
              rows={audience.slice(0, 50)}
              filename={`audience-by-${audSplit}-${days}d`}
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">Anonymous visitors show as <strong>Guest</strong>. <strong>Account type</strong> (member/vendor/staff), <strong>region</strong> and <strong>store type</strong> come from each account; set them on <Link href="/admin/users" className="text-brand-600 hover:underline">Users</Link>. <strong>Tenure</strong> is measured from signup.</p>
          </section>

          {/* ---------- Ads ---------- */}
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <SectionTitle>Ads — exposure → interaction</SectionTitle>
              <Link href={`/admin/analytics/advertisers?days=${days}`} className="text-xs font-bold text-brand-600 hover:underline">Per-advertiser reports →</Link>
            </div>
            <Compare current={adSplit} options={AD_SPLITS as unknown as [string, string][]} makeHref={(v) => url({ adSplit: v })} />
            <ReportTable
              columns={[{ key: 'key', label: adLabel }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'viewable', label: 'Viewable', type: 'int' }, { key: 'aboveFoldPct', label: 'Above fold', type: 'pct01' }, { key: 'avgDwellMs', label: 'Avg dwell', type: 'ms' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }]}
              rows={ads.slice(0, 50)}
              filename={`ads-by-${adSplit}-${days}d`}
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">Click a column to sort; <strong>Export CSV</strong> for a spreadsheet. CTR is clicks ÷ <em>viewable</em> impressions, so a low-placed ad isn&apos;t unfairly compared with a top one.</p>
          </section>

          {/* ---------- Video ads (quartile funnel) ---------- */}
          {video.length > 0 && (
            <section>
              <SectionTitle>Video ads — watch-through funnel</SectionTitle>
              <Compare current={vidSplit} options={VID_SPLITS as unknown as [string, string][]} makeHref={(v) => url({ vidSplit: v })} />
              <ReportTable
                columns={[{ key: 'key', label: vidLabel }, { key: 'views', label: 'Views', type: 'int' }, { key: 'q25', label: '25%', type: 'int' }, { key: 'q50', label: '50%', type: 'int' }, { key: 'q75', label: '75%', type: 'int' }, { key: 'q100', label: '100%', type: 'int' }, { key: 'completionRate', label: 'Completion', type: 'pct01' }]}
                rows={video.slice(0, 50)}
                filename={`video-by-${vidSplit}-${days}d`}
              />
              <p className="mt-1.5 text-xs text-[var(--muted)]"><strong>Views</strong> = playbacks started; each quartile is counted once per view, so <strong>Completion</strong> is finishes ÷ views. Video creatives autoplay muted &amp; in-view only.</p>
            </section>
          )}

          {/* ---------- Articles / modules ---------- */}
          <section>
            <SectionTitle>Articles &amp; modules — what presentation wins</SectionTitle>
            <Compare current={artSplit} options={ART_SPLITS as unknown as [string, string][]} makeHref={(v) => url({ artSplit: v })} />
            <ReportTable
              columns={[{ key: 'key', label: artLabel }, { key: 'impressions', label: 'Impr.', type: 'int' }, { key: 'clicks', label: 'Clicks', type: 'int' }, { key: 'ctr', label: 'CTR', type: 'pct01' }]}
              rows={eng.slice(0, 50)}
              filename={`articles-by-${artSplit}-${days}d`}
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">Split by <strong>Image vs none</strong> or <strong>Position</strong> to compare like-for-like within the same surface.</p>
          </section>

          {/* ---------- Reading outcomes ---------- */}
          <section>
            <SectionTitle>Reading — outcome</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Avg active read" value={fmtMs(reading.avgActiveMs)} />
              <Tile label="Avg scroll depth" value={pctStr(reading.avgScrollPct / 100)} />
              <Tile label="Unique readers" value={nf(reading.uniqueReaders)} />
              <Tile label="Quick bounces" value={nf(reading.bounces)} hint="opened <5s" />
            </div>
            <div className="mt-3">
              <BarList title="Scroll reach" rows={[
                { key: 'Reached 25%', count: Math.round(reading.reach[25] * 100) },
                { key: 'Reached 50%', count: Math.round(reading.reach[50] * 100) },
                { key: 'Reached 75%', count: Math.round(reading.reach[75] * 100) },
                { key: 'Reached 100%', count: Math.round(reading.reach[100] * 100) },
              ]} suffix="%" max={100} />
            </div>
          </section>

          {/* ---------- Clippings funnel ---------- */}
          <section>
            <SectionTitle>Clippings</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Tile label="Saves" value={nf(clips.saves)} />
              <Tile label="Savers" value={nf(clips.savers)} />
              <Tile label="Comics" value={nf(clips.byKind.comic)} />
              <Tile label="Quotes" value={nf(clips.byKind.quote)} />
              <Tile label="Downloads" value={nf(clips.downloads)} />
              <Tile label="Expands" value={nf(clips.expands)} />
              <Tile label="Deletes" value={nf(clips.deletes)} />
            </div>
          </section>

          {capped && <p className="text-xs text-amber-600">Showing a capped sample of events for this window — totals may understate a very high-traffic period.</p>}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">{children}</h2>;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-2xl font-black leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}{hint ? <span className="ml-1 font-normal opacity-70">· {hint}</span> : ''}</div>
    </div>
  );
}

function Compare({ current, options, makeHref }: { current: string; options: [string, string][]; makeHref: (v: string) => string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-[var(--muted)]">Compare by:</span>
      {options.map(([v, label]) => (
        <Link key={v} href={makeHref(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${current === v ? 'bg-brand-600 text-white' : 'border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--fg)]'}`}>{label}</Link>
      ))}
    </div>
  );
}

function BarList({ title, rows, suffix = '', max }: { title: string; rows: { key: string; count: number }[]; suffix?: string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</div>
      <div className="space-y-1.5">
        {rows.length === 0 && <div className="text-sm text-[var(--muted)]">No data.</div>}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs font-semibold capitalize">{r.key}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded bg-[var(--bg-soft)]">
              <span className="absolute inset-y-0 left-0 rounded bg-brand-600" style={{ width: `${(r.count / top) * 100}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums">{nf(r.count)}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
