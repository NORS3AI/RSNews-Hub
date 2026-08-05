'use client';
import { useEffect, useState } from 'react';
import { RS_SOLIDS, RS_TEXTURES, rsTextureUrl, isHexColor, isRsTexture } from '@/lib/studio';
import { Check, Plus } from '@/components/icons';

// RS-Mode background picker with two tabs: Theme (solids + textures + a saved
// library) and Hex (custom). A value is a hex color or a texture key.
export default function RsColorPicker({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const [tab, setTab] = useState<'theme' | 'hex'>(isRsTexture(value) ? 'theme' : 'theme');
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/rs-swatches').then((r) => r.json()).then((d) => { if (alive && Array.isArray(d.swatches)) setCustom(d.swatches); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function saveToLibrary() {
    if (!isHexColor(value)) return;
    try { const r = await fetch('/api/admin/rs-swatches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hex: value }) }); const d = await r.json(); if (Array.isArray(d.swatches)) setCustom(d.swatches); } catch {}
  }

  const isSel = (v: string) => value === v;

  return (
    <div>
      <div className="mb-2 inline-flex gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-0.5 text-xs font-bold">
        {(['theme', 'hex'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 ${tab === t ? 'bg-brand-600 text-white' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>{t === 'theme' ? 'Theme' : 'Hex'}</button>
        ))}
        {value && <button onClick={() => onChange(null)} className="ml-1 rounded-md px-2.5 py-1 text-[var(--muted)] hover:text-[var(--fg)]" title="Reset to theme default">Clear</button>}
      </div>

      {tab === 'theme' ? (
        <div className="space-y-2.5">
          <div>
            <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">Textures</div>
            <div className="flex flex-wrap gap-1.5">
              {RS_TEXTURES.map((t) => (
                <button key={t.key} title={t.label} onClick={() => onChange(t.key)}
                  className={`h-9 w-9 overflow-hidden rounded-md border-2 ${isSel(t.key) ? 'border-brand-600' : 'border-[var(--border)]'}`}
                  style={{ backgroundImage: `url('${t.url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-label={t.label} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">Colors</div>
            <div className="flex flex-wrap gap-1.5">
              {RS_SOLIDS.map((s) => (
                <Swatch key={s.value} color={s.value} label={s.label} selected={isSel(s.value)} onClick={() => onChange(s.value)} />
              ))}
              {custom.map((c) => (
                <Swatch key={c} color={c} label={c} selected={isSel(c)} onClick={() => onChange(c)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input type="color" value={isHexColor(value) ? (value as string) : '#e97d34'} onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5" />
          <input className="input flex-1 font-mono text-xs" value={isHexColor(value) ? (value as string) : ''} placeholder="#RRGGBB"
            onChange={(e) => { const v = e.target.value.trim(); onChange(isHexColor(v) ? v : v === '' ? null : value ?? null); }} />
          <button onClick={saveToLibrary} disabled={!isHexColor(value)} className="btn-outline btn-sm shrink-0" title="Save this color to your library"><Plus width={13} height={13} /> Save</button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-[var(--muted)]">Applies in <strong>RS Mode</strong> only. Toggle “RS-Mode preview” to see it.</p>
    </div>
  );
}

function Swatch({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button title={label} onClick={onClick} aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-md border-2 ${selected ? 'border-brand-600' : 'border-[var(--border)]'}`}
      style={{ background: color }}>
      {selected && <Check width={14} height={14} className="text-white mix-blend-difference" />}
    </button>
  );
}
