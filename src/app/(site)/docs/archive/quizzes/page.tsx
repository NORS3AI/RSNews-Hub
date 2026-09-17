import Link from 'next/link';
import { getQuizzesArchiveData } from '@/lib/archiveData';
import { Check, ArrowLeft } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pop Quiz archive' };

export default async function QuizzesArchive() {
  const quizzes = await getQuizzesArchiveData();

  return (
    <div className="container-page py-8 sm:py-10">
      <Link href="/docs/archive" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"><ArrowLeft width={16} height={16} /> Archive</Link>
      <div className="mb-8 flex items-center gap-2"><Check className="text-brand-600" /><h1 className="text-2xl font-bold">Pop Quiz</h1></div>
      {quizzes.length === 0 && <p className="text-[var(--muted)]">No quizzes yet.</p>}

      <div className="space-y-3">
        {quizzes.map((q) => {
          const closed = !!q.closesAt && q.closesAt < new Date();
          return (
            <section key={q.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold leading-snug">{q.title}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {q._count.questions} question{q._count.questions === 1 ? '' : 's'} · {q.submissions.toLocaleString()} submission{q.submissions === 1 ? '' : 's'}
                </p>
              </div>
              {q.active && !closed
                ? <span className="badge shrink-0 bg-green-100 text-green-700">Live</span>
                : <span className="badge shrink-0 bg-amber-100 text-amber-700">Closed</span>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
