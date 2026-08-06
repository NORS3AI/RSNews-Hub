'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setRsBackground } from '@/lib/actions';
import { Check, Stamp } from '@/components/icons';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Admin control for the RS-Mode page background color. Only affects RS Mode;
// clearing it restores the default textured surround.
export default function RsBackgroundControl({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const dirty = value !== current;
  const valid = value === '' || HEX_RE.test(value);

  const save = (v: string) => start(async () => { await setRsBackground(v); router.refresh(); });

  return (
    <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
      <div className="mb-1 flex items-center gap-2 font-semibold"><Stamp width={16} height={16} className="text-brand-600" /> RS-Mode background</div>
      <p className="mb-3 text-sm text-[var(--muted)]">Sets the page background shown behind modules in <strong>RS Mode</strong> only. Light and Dark are unaffected. Leave empty for the default textured surround.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={HEX_RE.test(value) ? value : '#2b333c'} onChange={(e) => setValue(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" aria-label="RS background color" />
        <input className="input !w-40 font-mono text-xs" value={value} placeholder="default"
          onChange={(e) => setValue(e.target.value.trim())} aria-label="RS background hex" />
        <button disabled={pending || !dirty || !valid} onClick={() => save(value)} className="btn-primary btn-sm">
          {pending ? 'Saving…' : <><Check width={14} height={14} /> Save</>}
        </button>
        {current && <button disabled={pending} onClick={() => { setValue(''); save(''); }} className="btn-outline btn-sm">Reset</button>}
      </div>
      {!valid && <p className="mt-1.5 text-xs text-red-600">Enter a hex color like #2b333c, or clear it.</p>}
    </div>
  );
}
