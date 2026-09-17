import { prisma } from '@/lib/db';
import type { PollData } from '@/components/site/PollCard';
import type { QuizData } from '@/components/site/QuizCard';

export type ArticleEmbeds = {
  polls: { data: PollData; votedOptionId: string | null }[];
  quizzes: { data: QuizData; done: boolean }[];
};

const EMPTY: ArticleEmbeds = { polls: [], quizzes: [] };

// Pull the poll/quiz ids an article's body embeds. The composer serializes each
// embed as `<div data-poll="ID">` / `<div data-quiz="ID">`, so a cheap scan of
// the stored HTML tells us which records to hydrate — no DOM needed server-side.
function idsFrom(html: string, attr: 'data-poll' | 'data-quiz'): string[] {
  const re = new RegExp(`${attr}="([^"]+)"`, 'g');
  const out = new Set<string>();
  for (const m of html.matchAll(re)) if (m[1]) out.add(m[1]);
  return [...out];
}

// Resolves the interactive poll/quiz cards referenced inline in an article body
// to their live data (plus this reader's prior vote/response), so the reader
// renders real, votable cards rather than static placeholders. Closed embeds are
// dropped. Safe to call with no user (votedOptionId/done just come back empty).
export async function resolveArticleEmbeds(html: string, userId?: string | null): Promise<ArticleEmbeds> {
  if (!html) return EMPTY;
  const pollIds = idsFrom(html, 'data-poll');
  const quizIds = idsFrom(html, 'data-quiz');
  if (!pollIds.length && !quizIds.length) return EMPTY;
  const now = new Date();

  const [polls, quizzes, pollVotes, quizResponses] = await Promise.all([
    pollIds.length
      // `active` too, not just closesAt: an admin-deactivated poll must not render
      // as an open, votable card (the vote route rejects it → confusing 403).
      ? prisma.poll.findMany({ where: { id: { in: pollIds }, active: true }, include: { options: { orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } } } })
      : Promise.resolve([]),
    quizIds.length
      ? prisma.quiz.findMany({ where: { id: { in: quizIds }, active: true }, include: { questions: { orderBy: { order: 'asc' }, select: { id: true, prompt: true, options: { orderBy: { order: 'asc' }, select: { id: true, label: true } } } } } })
      : Promise.resolve([]),
    userId && pollIds.length
      ? prisma.pollVote.findMany({ where: { userId, pollId: { in: pollIds } }, select: { pollId: true, optionId: true } })
      : Promise.resolve([]),
    userId && quizIds.length
      ? prisma.quizResponse.findMany({ where: { userId, quizId: { in: quizIds } }, select: { quizId: true } })
      : Promise.resolve([]),
  ]);

  const voteByPoll = new Map(pollVotes.map((v) => [v.pollId, v.optionId]));
  const doneQuizzes = new Set(quizResponses.map((r) => r.quizId));

  return {
    polls: polls
      .filter((p) => !(p.closesAt && p.closesAt < now))
      .map((p) => ({ data: { id: p.id, question: p.question, closesAt: p.closesAt, options: p.options }, votedOptionId: voteByPoll.get(p.id) ?? null })),
    quizzes: quizzes
      .filter((q) => q.closesAt >= now)
      .map((q) => ({ data: { id: q.id, title: q.title, closesAt: q.closesAt, questions: q.questions }, done: doneQuizzes.has(q.id) })),
  };
}
