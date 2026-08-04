'use client';
import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/uploadClient';

/**
 * Image picker for ad creatives and comics. On upload the file is sent to
 * /api/uploads and the returned URL is stored in a hidden input (rows stay
 * small — no inline base64). You can also paste a URL/path (e.g. /ads/x.png).
 * Existing data-URL values keep working. Shows a live thumbnail.
 */
export default function AdImageInput({
  name, label, hint, defaultValue = '',
}: { name: string; label: string; hint?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const res = await uploadImage(file);
    setBusy(false);
    if (res.ok) setValue(res.url);
    else setError(res.error);
    if (fileRef.current) fileRef.current.value = '';
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
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-outline btn-sm">
              {busy ? 'Uploading…' : 'Upload…'}
            </button>
            {value && <button type="button" onClick={() => { setValue(''); setError(null); }} className="btn-ghost btn-sm text-red-500">Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
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
