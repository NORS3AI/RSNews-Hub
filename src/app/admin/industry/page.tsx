import { prisma } from '@/lib/db';
import { saveIndustryLink, deleteIndustryLink } from '@/lib/actions';
import IndustryQuickAdd from '@/components/admin/IndustryQuickAdd';
import InlineDelete from '@/components/admin/InlineDelete';
import { linkSource, postedLabel } from '@/lib/industry';
import { Eye } from '@/components/icons';

export const dynamic = 'force-dynamic';

const Fields = ({ link }: { link?: any }) => (
  <>
    <div><label className="label">Article title</label><input name="title" required defaultValue={link?.title ?? ''} className="input" placeholder="Fed signals rate cut as inflation cools" /></div>
    <div><label className="label">Link (URL)</label><input name="url" required defaultValue={link?.url ?? ''} className="input" placeholder="https://reuters.com/…" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="label">Source (optional)</label><input name="source" defaultValue={link?.source ?? ''} className="input" placeholder="Reuters" /><p className="mt-1 text-xs text-[var(--muted)]">Blank = use the link&apos;s domain.</p></div>
      <div><label className="label">Order</label><input name="order" type="number" defaultValue={link?.order ?? 0} className="input" /></div>
    </div>
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <label className="label">Posted date/time</label>
        <input name="postedAt" type="datetime-local" defaultValue={link ? toLocalInput(link.postedAt) : ''} className="input" />
      </div>
      <label className="mb-2.5 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={link ? link.active : true} className="h-4 w-4" /> Active</label>
    </div>
  </>
);

function toLocalInput(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export default async function AdminIndustry() {
  const links = await prisma.industryLink.findMany({ orderBy: [{ order: 'asc' }, { postedAt: 'desc' }] });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Industry News</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        Curated external links shown in the scrollable <strong>Industry News</strong> homepage module. Each row shows the title, the source, when you posted it, and its click count. Lower <strong>Order</strong> numbers appear first; ties fall back to newest posted.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <IndustryQuickAdd />

        <div className="space-y-3 lg:col-span-2">
          {links.map((l) => (
            <div key={l.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <details className="min-w-0 flex-1">
                  <summary className="flex cursor-pointer items-center gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{l.title}</span>
                      <span className="mt-0.5 flex items-center gap-3 text-xs text-[var(--muted)]">
                        <span className="font-bold">{linkSource(l.url, l.source)}</span>
                        <span>{postedLabel(l.postedAt)}</span>
                        <span className="flex items-center gap-1"><Eye width={12} height={12} />{l.views}</span>
                        {!l.active && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">hidden</span>}
                      </span>
                    </span>
                  </summary>
                  <form action={saveIndustryLink} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                    <input type="hidden" name="id" value={l.id} />
                    <Fields link={l} />
                    <button className="btn-primary btn-sm">Save changes</button>
                  </form>
                </details>
                <InlineDelete action={deleteIndustryLink.bind(null, l.id)} />
              </div>
            </div>
          ))}
          {links.length === 0 && <p className="text-[var(--muted)]">No links yet. Add the first industry-news link on the left.</p>}
        </div>
      </div>
    </div>
  );
}
