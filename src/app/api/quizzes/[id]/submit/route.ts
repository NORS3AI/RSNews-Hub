import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isQuizOpen, validateAnswers } from '@/lib/quiz';
import { parseJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Records a reader's quiz submission. Requires a logged-in account and allows
// one submission per user (enforced by the QuizResponse unique constraint).
// Validates the quiz is still open, tallies each chosen option, logs the raw
// response, and bumps the submission counter. No score is returned — correct
// answers are revealed later in a reflection article.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const parsed = await parseJson(req, z.object({ answers: z.record(z.string(), z.string()).optional() }));
  if (!parsed.ok) return parsed.res;
  const answers: Record<string, string> = parsed.data.answers ?? {};

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: { questions: { include: { options: { select: { id: true } } } } },
  });
  if (!quiz || !isQuizOpen(quiz)) {
    return NextResponse.json({ error: 'Quiz closed' }, { status: 403 });
  }

  // Only accept option ids that belong to their question in this quiz.
  const valid = new Map(quiz.questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))]));
  const chosen = validateAnswers(answers, valid);
  if (chosen.length === 0) return NextResponse.json({ error: 'No valid answers' }, { status: 400 });

  // One response per account. Reserve the slot first so a duplicate is rejected
  // cleanly (a race loses to the unique constraint → 409). The response insert
  // and the tallies commit together in ONE transaction, so a crash between them
  // can't record a submission whose option counts were never incremented (the
  // user can't re-submit to fix it).
  try {
    await prisma.$transaction(async (tx) => {
      // Reserve the unique response row first; a duplicate throws P2002 here and
      // aborts before any tally, so a rejected submission never counts.
      await tx.quizResponse.create({ data: { quizId: params.id, userId: user.id, answers: JSON.stringify(answers) } });
      for (const optionId of chosen) await tx.quizOption.update({ where: { id: optionId }, data: { count: { increment: 1 } } });
      await tx.quiz.update({ where: { id: params.id }, data: { submissions: { increment: 1 } } });
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
