'use client';
import { useEffect, useRef, useState } from 'react';
import { autosaveArticle } from '@/lib/actions';

// Background autosave for the article editor. Debounces edits and quietly saves
// the working draft (title/body/excerpt/cover) to the server, showing a small
// status. Only active when editing an existing article — a brand-new draft has
// no id yet, so it relies on the unsaved-changes guard until its first Save.
type State = 'on' | 'saving' | 'saved' | 'error';

export default function AutoSave({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [state, setState] = useState<State>('on');
  const [at, setAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    async function run() {
      const f = formRef.current;
      if (!f) return;
      if (inflight.current) { pending.current = true; return; } // coalesce
      inflight.current = true;
      setState('saving');
      try {
        const res = await autosaveArticle(new FormData(f));
        if (res.ok) { setState('saved'); setAt(res.at); } else { setState('on'); }
      } catch { setState('error'); }
      finally {
        inflight.current = false;
        if (pending.current) { pending.current = false; schedule(); }
      }
    }
    function schedule() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, 2500);
    }

    form.addEventListener('input', schedule);
    return () => { form.removeEventListener('input', schedule); if (timer.current) clearTimeout(timer.current); };
  }, [formRef]);

  const label =
    state === 'saving' ? 'Autosaving…'
    : state === 'error' ? 'Autosave failed — use Save'
    : state === 'saved' && at ? `Autosaved ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Autosave on';
  return (
    <span className={`text-xs ${state === 'error' ? 'text-red-600' : 'text-[var(--muted)]'}`} aria-live="polite">{label}</span>
  );
}
