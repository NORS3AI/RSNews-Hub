import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getHomepageInventory, type InventoryEntry } from '@/lib/homepageInventory';
import { Home, Edit, ExternalLink } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Homepage inventory' };

// Collapse a list of place labels (which may repeat) into "Place" or "Place (×n)".
function placeSummary(places: string[]): string {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].map(([p, n]) => (n > 1 ? `${p} (×${n})` : p)).join(' · ');
}

function editHref(e: InventoryEntry): string | null {
  if (e.kind === 'article') return `/admin/articles/${e.id}`;
  if (e.kind === 'poll') return '/admin/polls';
  if (e.kind === 'quiz') return '/admin/quizzes';
  return null;
}

export default async function HomepageInventoryPage() {
  const user = await getCurrentUser();
  const inv = await getHomepageInventory(user?.id);
  const dupes = inv.entries.filter((e) => e.count > 1);
  const singles = inv.entries.filter((e) => e.count === 1);
  const allDupeIds = dupes.map((e) => e.id).join(',');

  const KindChip = ({ kind }: { kind: InventoryEntry['kind'] }) => (
    <span className={`badge ${kind === 'article' ? 'bg-brand-600/15 text-brand-600' : kind === 'poll' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
      {kind === 'article' ? 'Article' : kind === 'poll' ? 'Poll' : 'Quiz'}
    </span>
  );

  const Row = ({ e }: { e: InventoryEntry }) => {
    const href = editHref(e);
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <span className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-sm font-black ${e.count > 1 ? 'bg-amber-500 text-white' : 'bg-[var(--card-2)] text-[var(--muted)]'}`} title={`${e.count} placement${e.count === 1 ? '' : 's'}`}>×{e.count}</span>
        <KindChip kind={e.kind} />
        <span className="min-w-0 flex-1 basis-64">
          <span className="block truncate font-semibold">{e.title || '(untitled)'}</span>
          <span className="block truncate text-xs text-[var(--muted)]">{placeSummary(e.places)}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/docs?hl=${e.id}`} className="btn-outline btn-sm" title="Open the homepage with this highlighted">
            <ExternalLink width={13} height={13} /> {e.count > 1 ? `Show all ${e.count}` : 'Show'}
          </Link>
          {href && <Link href={href} className="btn-ghost btn-sm !px-2" title="Edit"><Edit width={14} height={14} /></Link>}
        </div>
      </li>
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="module">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Home className="text-brand-600" width={22} height={22} /> On-page inventory</h1>
          <Link href="/admin/homepage" className="btn-outline btn-sm">Homepage layout</Link>
        </div>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Everything the public homepage is currently showing, with a count of how many times each appears — so you can spot anything running <strong>twice</strong> that you didn&apos;t mean to. Click <strong>Show</strong> to open the homepage with those copies ringed in blue (clears on refresh). Covers the main content modules; the bottom &ldquo;more to explore&rdquo; strips deliberately resurface stories and aren&apos;t counted.
        </p>

        {/* Summary */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[['Placements', inv.totalSlots], ['Unique items', inv.uniqueCount], ['Duplicated', inv.dupeCount]].map(([label, n], i) => (
            <div key={label as string} className={`tile p-3 text-center ${i === 2 && (n as number) > 0 ? '!border-amber-400' : ''}`}>
              <div className={`text-2xl font-black ${i === 2 && (n as number) > 0 ? 'text-amber-500' : ''}`}>{n as number}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label as string}</div>
            </div>
          ))}
        </div>

        {dupes.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wide text-amber-600">Duplicated ({dupes.length})</h2>
              <Link href={`/docs?hl=${allDupeIds}`} className="btn-outline btn-sm">Show all duplicates on homepage</Link>
            </div>
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-amber-300 bg-[var(--card-2)] dark:border-amber-800">
              {dupes.map((e) => <Row key={e.id} e={e} />)}
            </ul>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-[var(--muted)]">Shown once ({singles.length})</h2>
          {singles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing here — everything currently on the homepage appears more than once.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-2)]">
              {singles.map((e) => <Row key={e.id} e={e} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
