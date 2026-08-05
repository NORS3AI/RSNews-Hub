'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addElementToHomepage } from '@/lib/actions';
import RsColorPicker from '@/components/admin/studio/RsColorPicker';
import { Home, Check } from '@/components/icons';

const SIZES: [string, string][] = [['card', 'Card'], ['column', 'Column'], ['sidebar', 'Sidebar']];

// One-click post of a poll/quiz to the homepage as its own module — pick a size
// and (optional) RS-Mode theme color, then it's published + staged.
export default function AddToHomepageButton({ kind, id, name }: { kind: 'poll' | 'quiz'; id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState('card');
  const [color, setColor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function add() {
    start(async () => { await addElementToHomepage(kind, id, name, shape, color); setDone(true); setOpen(false); router.refresh(); });
  }

  if (done) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><Check width={13} height={13} /> Staged — <Link href="/admin/homepage" className="underline">arrange &amp; Go Live</Link></span>;
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-outline btn-sm"><Home width={14} height={14} /> Add to homepage</button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left shadow-lg">
            <div className="mb-1.5 text-xs font-bold">Size</div>
            <div className="mb-3 flex gap-1.5">
              {SIZES.map(([v, l]) => (
                <button key={v} onClick={() => setShape(v)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${shape === v ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)]'}`}>{l}</button>
              ))}
            </div>
            <div className="mb-1.5 text-xs font-bold">Theme color <span className="font-normal text-[var(--muted)]">(RS Mode)</span></div>
            <RsColorPicker value={color} onChange={setColor} />
            <button onClick={add} disabled={pending} className="btn-primary btn-sm mt-3 w-full">{pending ? 'Adding…' : 'Add & publish'}</button>
          </div>
        </>
      )}
    </div>
  );
}
