'use client';
import { useRef, useState } from 'react';

/**
 * Image picker for an ad creative. Uploaded files are read as data URLs and
 * stored in a hidden input (same approach as article cover images). You can
 * also paste a URL/path (e.g. /ads/banner.png). Shows a live thumbnail.
 */
export default function AdImageInput({
  name, label, hint, defaultValue = '',
}: { name: string; label: string; hint?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setValue(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input value={value.startsWith('data:') ? '' : value} onChange={(e) => setValue(e.target.value)}
            placeholder="/ads/your-banner.png or https://…" className="input text-xs" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline btn-sm">Upload…</button>
            {value && <button type="button" onClick={() => setValue('')} className="btn-ghost btn-sm text-red-500">Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          </div>
          {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
        </div>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-28 shrink-0 rounded-md border border-[var(--border)] object-contain" />
        )}
      </div>
    </div>
  );
}
