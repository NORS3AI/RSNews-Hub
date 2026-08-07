'use client';
import { useState } from 'react';
import { Plus, Trash } from '@/components/icons';

// Structured, non-destructive quiz editor. Existing questions/options keep their
// id (hidden in the serialized payload) so the server edits them in place and
// their response counts survive. Options/questions that already have responses
// can be relabelled and re-flagged but not removed.
type Opt = { id: string; label: string; correct: boolean; count: number };
type Q = { id: string; prompt: string; options: Opt[] };

export default function QuizEditor({ questions }: { questions: Q[] }) {
  const [qs, setQs] = useState<Q[]>(
    questions.length ? questions : [{ id: '', prompt: '', options: [{ id: '', label: '', correct: true, count: 0 }, { id: '', label: '', correct: false, count: 0 }] }],
  );

  const update = (fn: (draft: Q[]) => Q[]) => setQs((prev) => fn(prev.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }))));

  const setPrompt = (qi: number, prompt: string) => update((d) => { d[qi].prompt = prompt; return d; });
  const setLabel = (qi: number, oi: number, label: string) => update((d) => { d[qi].options[oi].label = label; return d; });
  const toggleCorrect = (qi: number, oi: number) => update((d) => { d[qi].options[oi].correct = !d[qi].options[oi].correct; return d; });
  const addOption = (qi: number) => update((d) => { if (d[qi].options.length < 8) d[qi].options.push({ id: '', label: '', correct: false, count: 0 }); return d; });
  const removeOption = (qi: number, oi: number) => update((d) => { if (d[qi].options[oi].count === 0 && d[qi].options.length > 2) d[qi].options.splice(oi, 1); return d; });
  const addQuestion = () => update((d) => { if (d.length < 20) d.push({ id: '', prompt: '', options: [{ id: '', label: '', correct: true, count: 0 }, { id: '', label: '', correct: false, count: 0 }] }); return d; });
  const removeQuestion = (qi: number) => update((d) => { const answered = d[qi].options.some((o) => o.count > 0); if (!answered && d.length > 1) d.splice(qi, 1); return d; });

  // Serialized for the server action — ids preserved, counts stripped.
  const payload = JSON.stringify(qs.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct })) })));

  return (
    <div className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <label className="label">Questions — edit in place; responses are kept. Tick the correct option(s).</label>
      {qs.map((q, qi) => {
        const qAnswered = q.options.some((o) => o.count > 0);
        return (
          <div key={qi} className="rounded-lg border border-[var(--border)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--muted)]">Q{qi + 1}</span>
              <input value={q.prompt} onChange={(e) => setPrompt(qi, e.target.value)} required maxLength={300}
                placeholder="Question prompt" className="input flex-1" />
              <button type="button" onClick={() => removeQuestion(qi)} disabled={qAnswered || qs.length <= 1}
                title={qAnswered ? 'Has responses — can’t remove' : qs.length <= 1 ? 'A quiz needs a question' : 'Remove question'}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:text-red-600 disabled:opacity-40">
                <Trash width={15} height={15} />
              </button>
            </div>
            <div className="space-y-1.5 pl-6">
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--muted)]" title="Correct answer">
                    <input type="checkbox" checked={o.correct} onChange={() => toggleCorrect(qi, oi)} className="h-4 w-4" />
                  </label>
                  <input value={o.label} onChange={(e) => setLabel(qi, oi, e.target.value)} required maxLength={200}
                    placeholder={`Option ${oi + 1}`} className="input flex-1" />
                  {o.count > 0 ? (
                    <span className="shrink-0 whitespace-nowrap px-1 text-xs text-[var(--muted)]">{o.count} pick{o.count === 1 ? '' : 's'}</span>
                  ) : (
                    <button type="button" onClick={() => removeOption(qi, oi)} disabled={q.options.length <= 2}
                      title={q.options.length <= 2 ? 'Need 2+ options' : 'Remove option'}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:text-red-600 disabled:opacity-40">
                      <Trash width={14} height={14} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 8 && (
                <button type="button" onClick={() => addOption(qi)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                  <Plus width={13} height={13} /> Add option
                </button>
              )}
            </div>
          </div>
        );
      })}
      {qs.length < 20 && (
        <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          <Plus width={14} height={14} /> Add question
        </button>
      )}
    </div>
  );
}
