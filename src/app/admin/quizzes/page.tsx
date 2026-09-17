import { prisma } from '@/lib/db';
import { createQuiz, updateQuiz, deleteQuiz } from '@/lib/actions';
import { ActionButtons } from '@/components/admin/RowActions';
import AddToHomepageButton from '@/components/admin/AddToHomepageButton';
import AutoPlugForm from '@/components/admin/AutoPlugForm';
import StatusChip from '@/components/admin/StatusChip';
import QuizEditor from '@/components/admin/QuizEditor';
import { timedStatus } from '@/lib/contentStatus';

export const dynamic = 'force-dynamic';

function toLocalInput(d?: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export default async function AdminQuizzes() {
  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: 'desc' },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Pop Quiz</h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        A short multiple-choice quiz shown as a small card on the homepage with a 48-hour countdown. When the timer ends the card disappears and late submissions are refused. Publishing a new quiz as <strong>active</strong> retires the previous one here to the archive. Correct answers are stored but never sent to readers — reveal them in a follow-up article using the response breakdown below.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <AutoPlugForm kind="quiz" action={createQuiz} className="card h-fit space-y-3 p-5 lg:col-span-1">
          <h2 className="font-semibold">New quiz</h2>
          <div><label className="label">Title</label><input name="title" required className="input" placeholder="Shipping trivia — week 32" /></div>
          <div>
            <label className="label">Questions</label>
            <textarea name="questions" required className="input min-h-[180px] font-mono text-[13px]"
              placeholder={'Question prompt on its own line\n*Correct option (prefix with *)\nAnother option\nA third option\n\nNext question prompt\nOption A\n*Option B'} />
            <p className="mt-1 text-xs text-[var(--muted)]">Separate questions with a blank line. First line = prompt, then 2–8 options. Prefix the correct option with <code>*</code>.</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-28"><label className="label">Open for (hours)</label><input name="hours" aria-label="Open for (hours)" type="number" min={1} defaultValue={48} className="input" /></div>
            <div className="flex-1"><label className="label">Or close at</label><input name="closesAt" aria-label="Or close at" type="datetime-local" className="input" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked className="h-4 w-4" /> Active (show on homepage)</label>
          <button className="btn-primary w-full">Publish quiz</button>
        </AutoPlugForm>

        <div className="space-y-3 lg:col-span-2">
          {quizzes.map((quiz) => {
            const closed = quiz.closesAt < new Date();
            const live = quiz.active && !closed;
            return (
              <details key={quiz.id} className="card p-4" open={live}>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{quiz.title}</span>
                    <span className="mt-0.5 text-xs text-[var(--muted)]">{quiz.submissions} submission{quiz.submissions === 1 ? '' : 's'} · {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} · closes {quiz.closesAt.toLocaleString()}</span>
                  </span>
                  <span className="shrink-0">
                    <StatusChip status={timedStatus(quiz, Date.now())} />
                  </span>
                </summary>

                <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                  {quiz.questions.map((q, qi) => {
                    const qTotal = q.options.reduce((n, o) => n + o.count, 0);
                    return (
                      <div key={q.id}>
                        <div className="mb-2 text-sm font-bold">{qi + 1}. {q.prompt}</div>
                        <div className="space-y-1.5">
                          {q.options.map((o) => {
                            const pct = qTotal ? Math.round((o.count / qTotal) * 100) : 0;
                            return (
                              <div key={o.id} className={`relative overflow-hidden rounded-lg border px-3 py-2 text-sm ${o.correct ? 'border-green-500/60' : 'border-[var(--border)]'}`}>
                                <div className="absolute inset-y-0 left-0 bg-brand-600/15" style={{ width: `${pct}%` }} />
                                <div className="relative flex items-center justify-between gap-2">
                                  <span className="font-semibold">{o.correct && <span className="mr-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700">Answer</span>}{o.label}</span>
                                  <span className="text-xs text-[var(--muted)]">{o.count} · {pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form action={updateQuiz} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <input type="hidden" name="id" value={quiz.id} />
                  <div><label className="label">Title</label><input name="title" required defaultValue={quiz.title} className="input" /></div>
                  <QuizEditor questions={quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct, count: o.count })) }))} />
                  <div className="flex items-end gap-4">
                    <div className="flex-1"><label className="label">Closes</label><input name="closesAt" aria-label="Quiz closes at" type="datetime-local" defaultValue={toLocalInput(quiz.closesAt)} className="input" /></div>
                    <label className="mb-2.5 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={quiz.active} className="h-4 w-4" /> Active</label>
                  </div>
                  <div className="flex items-center justify-between">
                    <button className="btn-primary btn-sm">Save</button>
                    <ActionButtons actions={[{ label: 'Delete', run: deleteQuiz.bind(null, quiz.id), danger: true, confirm: 'Delete this quiz and all its responses permanently? This can\'t be undone.' }]} />
                  </div>
                </form>
                <div className="mt-3 flex justify-end border-t border-[var(--border)] pt-3">
                  <AddToHomepageButton kind="quiz" id={quiz.id} name={quiz.title} />
                </div>
              </details>
            );
          })}
          {quizzes.length === 0 && <p className="text-[var(--muted)]">No quizzes yet. Publish the first one on the left.</p>}
        </div>
      </div>
    </div>
  );
}
