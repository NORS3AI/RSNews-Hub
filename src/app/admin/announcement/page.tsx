import { getAnnouncement } from '@/lib/announcement';
import { saveAnnouncement } from '@/lib/actions';

export const dynamic = 'force-dynamic';

// Admin: the site-wide top-strip announcement (optionally with a live countdown).
export default async function AdminAnnouncement() {
  const a = await getAnnouncement();
  // datetime-local wants "YYYY-MM-DDTHH:mm"; slice the stored ISO instant.
  const targetLocal = a.targetAt ? a.targetAt.slice(0, 16) : '';

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Announcement bar</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        A dismissible strip across the top of the site — great for a heads-up like an upcoming event. Add a date to show a live countdown (leave it up for months; it ticks down on its own). Readers can dismiss it; changing the message brings it back.
      </p>

      <form action={saveAnnouncement} className="card space-y-4 p-5">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="enabled" defaultChecked={a.enabled} className="h-[18px] w-[18px] accent-brand-600" />
          <span className="font-semibold">Show the announcement bar</span>
        </label>

        <div>
          <label className="label" htmlFor="message">Message</label>
          <input id="message" name="message" defaultValue={a.message} maxLength={200} className="input" placeholder="RS Expo 2026 — the industry's biggest weekend" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="href">Link URL (optional)</label>
            <input id="href" name="href" defaultValue={a.href} className="input" placeholder="/docs/page/expo or https://…" />
          </div>
          <div>
            <label className="label" htmlFor="hrefLabel">Link button text</label>
            <input id="hrefLabel" name="hrefLabel" defaultValue={a.hrefLabel} maxLength={40} className="input" placeholder="Register" />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-4">
          <label className="flex items-center gap-3">
            <input type="checkbox" name="showCountdown" defaultChecked={a.showCountdown} className="h-[18px] w-[18px] accent-brand-600" />
            <span className="font-semibold">Show a live countdown</span>
          </label>
          <div className="mt-3">
            <label className="label" htmlFor="targetAt">Count down to</label>
            <input id="targetAt" name="targetAt" type="datetime-local" defaultValue={targetLocal} className="input max-w-xs" />
            <p className="mt-1 text-xs text-[var(--muted)]">The same date also powers the big countdown module (Module Studio → Countdown). Time is approximate to the hour.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="btn-primary btn-sm">Save announcement</button>
          <span className="text-xs text-[var(--muted)]">Saved changes appear on the site on the next page load.</span>
        </div>
      </form>
    </div>
  );
}
