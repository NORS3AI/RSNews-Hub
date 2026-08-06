'use client';
import { useRef, useState } from 'react';
import { saveIndustryLink } from '@/lib/actions';

/**
 * Dead-simple Industry News entry: paste ONE link, it reads the article and
 * fills in the headline (plus source + date behind the scenes), you confirm,
 * Add. No order/date/active knobs — those default sensibly and can still be
 * tweaked by opening a saved row. If a site can't be read, just type the
 * headline; source falls back to the domain and the date to now.
 */
export default function IndustryQuickAdd() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [postedAt, setPostedAt] = useState(''); // ISO
  const [note, setNote] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const lastRead = useRef('');

  async function readLink(value: string) {
    const u = value.trim();
    if (!u || !/^https?:\/\//i.test(u) || u === lastRead.current) return;
    lastRead.current = u;
    setNote({ kind: 'info', text: 'Reading the article…' });
    try {
      const res = await fetch(`/api/admin/industry/metadata?url=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (data.error) { setNote({ kind: 'err', text: data.error }); return; }
      const m = data.meta;
      setTitle(m.title || '');
      setSource(m.source || '');
      setPostedAt(m.publishedAt || '');
      if (!m.title) { setNote({ kind: 'err', text: "Couldn't read the headline — just type it below." }); return; }
      const dateLabel = m.publishedAt ? new Date(m.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const bits = [m.source, dateLabel].filter(Boolean);
      setNote({ kind: 'ok', text: bits.length ? `Got it — ${bits.join(' · ')}` : 'Got the headline' });
    } catch {
      setNote({ kind: 'err', text: "Couldn't read that link — just type the headline below." });
    }
  }

  return (
    <form action={saveIndustryLink} className="card h-fit space-y-4 p-5 lg:col-span-1">
      <div>
        <h2 className="font-semibold">Add a link</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Paste the article link — it reads the rest for you.</p>
      </div>

      <div>
        <label className="label">Article link</label>
        <input name="url" required value={url} autoComplete="off" placeholder="Paste a link…"
          onChange={(e) => setUrl(e.target.value)}
          onBlur={(e) => readLink(e.target.value)}
          onPaste={(e) => { const v = e.clipboardData.getData('text'); setTimeout(() => readLink(v), 0); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); readLink(url); } }}
          className="input" />
        {note && (
          <p className={`mt-1.5 text-xs ${note.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : note.kind === 'err' ? 'text-red-600 dark:text-red-400' : 'text-[var(--muted)]'}`}>{note.text}</p>
        )}
      </div>

      <div>
        <label className="label">Headline</label>
        <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Fills in automatically — or type it" />
      </div>

      {/* Automatic + hidden: source falls back to the link's domain, the date to
          the article's date (or now), newest first, and new links are shown. */}
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="postedAt" value={postedAt} />
      <input type="hidden" name="order" value="0" />
      <input type="hidden" name="active" value="1" />

      <button className="btn-primary w-full">Add link</button>
    </form>
  );
}
