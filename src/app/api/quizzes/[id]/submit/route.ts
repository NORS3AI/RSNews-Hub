import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Records a reader's quiz submission. Validates the quiz is still open (active
// and before closesAt), tallies each chosen option, logs the raw response, and
// bumps the submission counter. No score is returned — correct answers are
// revealed later in a reflection article.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let answers: Record<string, string> = {};
  try { answers = (await req.json())?.answers || {}; } catch {}

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: { questions: { include: { options: { select: { id: true, questionId: true } } } } },
  });
  if (!quiz || !quiz.active || quiz.closesAt < new Date()) {
    return NextResponse.json({ error: 'Quiz closed' }, { status: 403 });
  }

  // Only accept option ids that belong to this quiz, matched to their question.
  const validByQuestion = new Map(quiz.questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))]));
  const chosen: string[] = [];
  for (const [questionId, optionId] of Object.entries(answers)) {
    const set = validByQuestion.get(questionId);
    if (set && typeof optionId === 'string' && set.has(optionId)) chosen.push(optionId);
  }
  if (chosen.length === 0) return NextResponse.json({ error: 'No valid answers' }, { status: 400 });

  await prisma.$transaction([
    ...chosen.map((optionId) => prisma.quizOption.update({ where: { id: optionId }, data: { count: { increment: 1 } } })),
    prisma.quiz.update({ where: { id: params.id }, data: { submissions: { increment: 1 } } }),
    prisma.quizResponse.create({ data: { quizId: params.id, answers: JSON.stringify(answers) } }),
  ]);

  return NextResponse.json({ ok: true });
}
