'use client';
import { useRef } from 'react';

// The Body field for an email template + its merge-tag "word bank". Each tag is a
// button: click to drop it into the body at the cursor, hover to see a plain-
// English description of what it fills in (no programmer shorthand needed).
export default function TemplateBody({ name, defaultValue, tags }: {
  name: string; defaultValue: string; tags: { tag: string; desc: string }[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (tag: string) => {
    const el = ref.current;
    const token = `{${tag}}`;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + token + el.value.slice(end);
    el.focus();
    const caret = start + token.length;
    el.setSelectionRange(caret, caret);
  };

  return (
    <div>
      <label className="label text-xs">Body</label>
      <textarea ref={ref} name={name} defaultValue={defaultValue} rows={10} className="input font-mono text-[13px] leading-relaxed" required />
      <div className="mt-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Click a tag to insert it — it auto-fills when the email sends. Hover to see what each one means.</div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t.tag} className="group relative inline-flex">
              <button type="button" onClick={() => insert(t.tag)}
                className="badge bg-[var(--bg-soft)] text-[11px] transition-colors hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-950/50 dark:hover:text-brand-300">
                <code>{`{${t.tag}}`}</code>
              </button>
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg group-hover:block">
                {t.desc}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
