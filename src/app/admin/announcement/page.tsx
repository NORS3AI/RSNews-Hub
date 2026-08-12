import { listAnnouncements, getAnnouncementState } from '@/lib/announcement';
import AnnouncementManager from '@/components/admin/AnnouncementManager';

export const dynamic = 'force-dynamic';

// Admin: the site-wide top-strip announcement. A LIBRARY of saved messages plus
// two independent switches — the master on/off and which saved message is live.
// Saving a message never turns the bar on or changes which one shows: on is on,
// off is off, save is save.
export default async function AdminAnnouncement() {
  const [list, state] = await Promise.all([listAnnouncements(), getAnnouncementState()]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Announcement bar</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        A dismissible strip across the top of the site — great for a heads-up like an upcoming event. Build a library of messages, star the ones you reuse, and add a date for a live countdown. Saving a message only edits the library; use the on/off switch and “Show this” to control what readers actually see.
      </p>

      <AnnouncementManager list={list} enabled={state.enabled} liveId={state.liveId} />
    </div>
  );
}
