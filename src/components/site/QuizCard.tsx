'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Check, X } from '@/components/icons';

export type QuizOption = { id: string; label: string };
export type QuizQuestion = { id: string; prompt: string; options: QuizOption[] };
export type QuizData = { id: string; title: string; closesAt: string | Date; questions: QuizQuestion[] };

// "47h 12m" / "38m" style short countdown to the close time.
function fmtLeft(ms: number) {
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m left`;
  const s = Math.floor((ms % 60_000) / 1000);
  return m >= 1 ? `${m}m ${s}s left` : `${s}s left`;
}

/**
 * "Pop Quiz" — a small card with a 48-hour countdown. Submitting requires a
 * logged-in account and is limited to one submission per account (enforced
 * server-side). Tap to open the full multiple-choice quiz in a modal. After
 * the timer ends the card shows Closed; on the next load it is gone entirely.
 */
export default function QuizCard({ quiz, loggedIn, initialDone = false }: { quiz: QuizData; loggedIn: boolean; initialDone?: boolean }) {
  const closeMs = new Date(quiz.closesAt).getTime();
  const [now, setNow] = useState<number>(() => Date.now());
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const left = closeMs - now;
  const closed = left <= 0;
  const answeredAll = quiz.questions.every((q) => answers[q.id]);

  async function submit() {
    if (busy || done || closed) return;
    if (!answeredAll) { setErr('Please answer every question.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        setDone(true); setOpen(false);
      } else if (res.status === 409) {
        setDone(true); setOpen(false);
      } else if (res.status === 401) {
        setErr('Please log in to submit.');
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d?.error === 'Quiz closed' ? 'This quiz just closed.' : 'Something went wrong — try again.');
      }
    } catch { setErr('Something went wrong — try again.'); }
    setBusy(false);
  }

  return (
    <section className="module quiz-card flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.1em] text-white">Pop Quiz</span>
        <span className={`ml-auto flex items-center gap-1 text-xs font-bold ${closed ? 'text-[var(--muted)]' : 'text-brand-700 dark:text-brand-300'}`}>
          <Clock width={13} height={13} /> {fmtLeft(left)}
        </span>
      </div>
      <h2 className="mb-1 text-xl font-black leading-tight tracking-tight">{quiz.title}</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · multiple choice
      </p>

      {done ? (
        <div className="mt-auto rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm font-semibold">
          <span className="flex items-center gap-1.5 text-brand-700 dark:text-brand-300"><Check width={15} height={15} /> Answer submitted</span>
          <span className="mt-1 block font-medium text-[var(--muted)]">We&apos;ll share the results and answers in an article soon.</span>
        </div>
      ) : closed ? (
        <div className="mt-auto rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">This quiz has closed. Watch for the results article!</div>
      ) : loggedIn ? (
        <button onClick={() => setOpen(true)} className="btn-primary mt-auto w-full justify-center">Take the quiz</button>
      ) : (
        <Link href="/login" className="btn-primary mt-auto w-full justify-center">Log in to take the quiz</Link>
      )}

      {open && loggedIn && !done && !closed && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto p-4 py-8 animate-fade-in" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-xl rounded-2xl bg-[var(--card)] p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.1em] text-white">Pop Quiz</span>
                <h3 className="mt-2 text-2xl font-black leading-tight tracking-tight">{quiz.title}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300"><Clock width={13} height={13} /> {fmtLeft(left)}</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-soft)] hover:bg-[var(--border)]" aria-label="Close"><X /></button>
            </div>

            <div className="space-y-5">
              {quiz.questions.map((q, qi) => (
                <fieldset key={q.id}>
                  <legend className="mb-2 font-extrabold leading-snug">{qi + 1}. {q.prompt}</legend>
                  <div className="space-y-2">
                    {q.options.map((o) => {
                      const picked = answers[q.id] === o.id;
                      return (
                        <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 font-semibold transition ${picked ? 'border-brand-500 bg-brand-600/10' : 'border-[var(--border)] hover:border-brand-400 hover:bg-[var(--bg-soft)]'}`}>
                          <input type="radio" name={q.id} value={o.id} checked={picked}
                            onChange={() => { setAnswers((a) => ({ ...a, [q.id]: o.id })); setErr(''); }}
                            className="h-4 w-4 accent-brand-600" />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            {err && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{err}</p>}
            <button onClick={submit} disabled={busy} className="btn-primary mt-5 w-full justify-center disabled:opacity-70">
              {busy ? 'Submitting…' : 'Submit answers'}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">One submission per account. Correct answers revealed later.</p>
          </div>
        </div>
      )}
    </section>
  );
}
