import Link from 'next/link';
import { loadEvents, totalEventCount, loadUserInfo, loadMembers, rangeDays } from '@/lib/analytics/query';
import { aggregateActivation, aggregateNewVsReturning, aggregateCohortReturn } from '@/lib/analytics/retention';
import { aggregateAds, aggregateEngagement, aggregateReading, aggregateClips, aggregateOverview, aggregateVideo, aggregateThemes, ctr } from '@/lib/analytics/metrics';
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
const pctOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
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

  const [{ events, capped }, total, series, members] = await Promise.all([loadEvents(days), totalEventCount(), loadDailySeries(new Date(), days), loadMembers()]);
  const ov = aggregateOverview(events);
  // Member activation + retention — are invited members showing up, doing
  // something, and coming back? (signed-in accounts only)
  const act = aggregateActivation(members, events);
  const cohort = aggregateCohortReturn(members, events, rangeDays(days).since);
  const activePerDay = aggregateNewVsReturning(members, events).map((d) => ({ key: d.day, count: d.newMembers + d.returningMembers }));

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
  const themes = aggregateThemes(events);
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
              <Tile label="Visitors" value={nf(ov.visitors)} tip="Distinct people who loaded any hub page in this window — counted by browser for guests, by account for signed-in members." />
              <Tile label="Sessions" value={nf(ov.sessions)} tip="Browsing sessions. A session ends after about 30 minutes of inactivity, so one person can have several over the window." />
              <Tile label="Pageviews" value={nf(ov.pageviews)} tip="Total pages loaded, including repeat views of the same page. Always higher than Visitors." />
              <Tile label="Article opens" value={nf(ov.articleOpens)} tip="Times an article was opened to read (reader view or modal), across everyone." />
              <Tile label="Opens / session" value={String(ov.opensPerSession)} tip="Average articles opened per session — a quick gauge of how deep a typical visit goes." />
              <Tile label="Signed-in" value={nf(ov.loggedInVisitors)} tip="Of the visitors, how many were logged-in members. The rest browsed anonymously." />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <BarList title="By device" rows={ov.byDevice} />
              <BarList title="By page" rows={ov.byPage} />
            </div>
          </section>

          {/* ---------- Members: activation & retention ---------- */}
          <section>
            <SectionTitle>Members — activation &amp; retention</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Members" value={nf(act.members)} hint="have opened the hub" tip="Members who've opened the hub at least once. An account is created on a member's first visit, so this is 'members reached' — not your full RS News roster, which lives on the parent site until people show up." />
              <Tile label={`Active · ${days}d`} value={nf(act.active)} hint={`${pctOf(act.active, act.members)} of members`} tip="Members who did anything at all in the hub during this window." />
              <Tile label={`Engaged · ${days}d`} value={nf(act.engaged)} hint={`${pctOf(act.engaged, act.active)} of active`} tip="Members who took a real action — opened or read an article, saved, recommended, clipped, or searched — not just landed on a page." />
              <Tile label="Came back" value={nf(act.returned)} hint={`${pctOf(act.returned, act.active)} of active`} tip="Members active on 2 or more different days in this window. The core 'is it sticky?' signal." />
              <Tile label={`New · ${days}d`} value={nf(cohort.cohortSize)} hint="joined this window" tip="Members who opened the hub for the very first time during this window." />
              <Tile label="New-member return" value={pctOf(cohort.returned, cohort.cohortSize)} hint={`${nf(cohort.returned)} came back`} tip="Of those brand-new members, the share who came back on a later day. The single clearest 'worth returning to' number." />
            </div>
            <div className="mt-3">
              <BarList title="Active members / day (new + returning)" rows={activePerDay} />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              <strong>Engaged</strong> = took a real action (opened/read an article, saved, recommended, clipped, searched) — not just landed.
              <strong> Came back</strong> = active on 2+ different days. <strong>New-member return</strong> = of members who first appeared in this window, the share who returned on a later day — the clearest signal the hub is worth coming back to. These count signed-in accounts only; anonymous traffic is in Hub overview above.
            </p>
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
            <p className="mt-1.5 text-xs text-[var(--muted)]">Anonymous visitors show as <strong>Guest</strong>. <strong>Account type</strong> (member/vendor/staff), <strong>region</strong> and <strong>store type</strong> come from each account; set them on <Link href="/admin/users" className="text-brand-600 underline">Users</Link>. <strong>Tenure</strong> is measured from signup.</p>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Avg active read" value={fmtMs(reading.avgActiveMs)} tip="Average time readers were actively engaged with an article — idle time is excluded, so this is real attention, not just how long the tab was open." />
              <Tile label="Avg scroll depth" value={pctStr(reading.avgScrollPct / 100)} tip="On average, how far down the article readers scrolled before leaving." />
              <Tile label="Unique readers" value={nf(reading.uniqueReaders)} tip="Distinct people who opened at least one article in this window." />
              <Tile label="Quick bounces" value={nf(reading.bounces)} hint="opened <5s" tip="Article opens abandoned in under 5 seconds — a sign the piece didn't hook them (or was opened by mistake)." />
              <Tile label="Recommends" value={nf(reading.recommends)} hint="cast in range" tip="Times readers hit 'Recommend' on an article during this window (each press counts)." />
              <Tile label="Recommenders" value={nf(reading.recommenders)} hint="unique readers" tip="Distinct people who recommended at least one article — the headcount behind the recommends." />
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
              <Tile label="Saves" value={nf(clips.saves)} tip="Clippings saved — a quote image or comic a reader kept to their collection." />
              <Tile label="Savers" value={nf(clips.savers)} tip="Distinct people who saved at least one clipping." />
              <Tile label="Comics" value={nf(clips.byKind.comic)} tip="Saved clippings that are comics." />
              <Tile label="Quotes" value={nf(clips.byKind.quote)} tip="Saved clippings that are quote images (a highlighted passage turned into a shareable graphic)." />
              <Tile label="Downloads" value={nf(clips.downloads)} tip="Times a saved clipping was downloaded as an image file." />
              <Tile label="Expands" value={nf(clips.expands)} tip="Times a clipping was opened to full size." />
              <Tile label="Deletes" value={nf(clips.deletes)} tip="Saved clippings a reader later removed from their collection." />
            </div>
          </section>

          {/* ---------- Theme usage ---------- */}
          <section>
            <SectionTitle>Theme — which mode people browse in</SectionTitle>
            {themes.totalUsers > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Light" value={`${nf(themes.rows[0].users)}`} hint={pctStr(themes.rows[0].pct)} tip="People whose most recent theme this window was Light mode." />
                  <Tile label="Dark" value={`${nf(themes.rows[1].users)}`} hint={pctStr(themes.rows[1].pct)} tip="People whose most recent theme this window was Dark mode." />
                  <Tile label="RS Mode" value={`${nf(themes.rows[2].users)}`} hint={pctStr(themes.rows[2].pct)} tip="People whose most recent theme this window was RS Mode (the branded look)." />
                  <Tile label="Theme switches" value={nf(themes.switches)} hint="deliberate toggles" tip="Times someone actively changed their theme — a signal of how much people fiddle with the appearance." />
                </div>
                <div className="mt-3">
                  <BarList title={`Share of ${nf(themes.totalUsers)} visitors`} rows={themes.rows.map((r) => ({ key: r.label, count: Math.round(r.pct * 100) }))} suffix="%" max={100} />
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">Each visitor is counted once, by their most recent theme in this window. Signed-in members are keyed by account; anonymous readers by their browser.</p>
              </>
            ) : (
              <div className="card p-5 text-sm text-[var(--muted)]">No theme signals yet for this window. They&apos;re recorded as people load the site and when they switch modes.</div>
            )}
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

function Tile({ label, value, hint, tip }: { label: string; value: string; hint?: string; tip?: string }) {
  return (
    <div
      className={`card group relative p-3.5${tip ? ' cursor-help' : ''}`}
      tabIndex={tip ? 0 : undefined}
      title={tip /* native fallback for touch + assistive tech */}>
      {tip && <span aria-hidden className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full border border-[var(--border)] text-[9px] font-black leading-none text-[var(--muted)] opacity-45 transition-opacity group-hover:opacity-90">i</span>}
      <div className="text-2xl font-black leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}{hint ? <span className="ml-1 font-normal opacity-70">· {hint}</span> : ''}</div>
      {tip && (
        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--fg)] px-3 py-2 text-left text-[11px] font-normal leading-snug text-[var(--card)] opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
          {tip}
        </span>
      )}
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
