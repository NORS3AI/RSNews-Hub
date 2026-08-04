import { prisma } from '@/lib/db';
import { createPoll, updatePoll, deletePoll } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

function toLocalInput(d?: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export default async function AdminPolls() {
  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Polls</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        A monthly reader poll with live results, shown next to Industry News on the homepage. Publishing a new poll as <strong>active</strong> automatically retires the previous one to the polls archive. Results update live as readers vote.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={createPoll} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">New poll</h2>
          <div><label className="label">Question</label><input name="question" required className="input" placeholder="What should we cover next?" /></div>
          <div>
            <label className="label">Options (one per line, 2–8)</label>
            <textarea name="options" required className="input min-h-[110px]" placeholder={'Shipping tips\nStore management\nMarketing\nIndustry news'} />
          </div>
          <div><label className="label">Closes (optional)</label><input name="closesAt" type="datetime-local" className="input" /></div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked className="h-4 w-4" /> Active (show on homepage)</label>
          <button className="btn-primary w-full">Publish poll</button>
        </form>

        <div className="space-y-3 lg:col-span-2">
          {polls.map((poll) => {
            const total = poll.options.reduce((n, o) => n + o.votes, 0);
            const closed = !!poll.closesAt && poll.closesAt < new Date();
            return (
              <details key={poll.id} className="card p-4" open={poll.active}>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{poll.question}</span>
                    <span className="mt-0.5 text-xs text-[var(--muted)]">{total} vote{total === 1 ? '' : 's'} · {poll.options.length} options</span>
                  </span>
                  <span className="shrink-0">
                    {poll.active ? <span className="badge bg-green-100 text-green-700">Active</span>
                      : closed ? <span className="badge bg-amber-100 text-amber-700">Closed</span>
                      : <span className="badge bg-[var(--bg-soft)] text-[var(--muted)]">Archived</span>}
                  </span>
                </summary>

                <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
                  {poll.options.map((o) => {
                    const pct = total ? Math.round((o.votes / total) * 100) : 0;
                    return (
                      <div key={o.id} className="relative overflow-hidden rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                        <div className="absolute inset-y-0 left-0 bg-brand-600/15" style={{ width: `${pct}%` }} />
                        <div className="relative flex items-center justify-between gap-2">
                          <span className="font-semibold">{o.label}</span>
                          <span className="text-xs text-[var(--muted)]">{o.votes} · {pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form action={updatePoll} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <input type="hidden" name="id" value={poll.id} />
                  <div><label className="label">Question</label><input name="question" required defaultValue={poll.question} className="input" /></div>
                  <div className="flex items-end gap-4">
                    <div className="flex-1"><label className="label">Closes</label><input name="closesAt" type="datetime-local" defaultValue={toLocalInput(poll.closesAt)} className="input" /></div>
                    <label className="mb-2.5 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={poll.active} className="h-4 w-4" /> Active</label>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Options and their votes can&apos;t be edited after publishing — create a new poll for next month.</p>
                  <div className="flex items-center justify-between">
                    <button className="btn-primary btn-sm">Save</button>
                    <ActionButtons actions={[{ label: 'Delete', run: deletePoll.bind(null, poll.id), danger: true, confirm: 'Delete this poll and all its votes?' }]} />
                  </div>
                </form>
              </details>
            );
          })}
          {polls.length === 0 && <p className="text-[var(--muted)]">No polls yet. Publish the first one on the left.</p>}
        </div>
      </div>
    </div>
  );
}
