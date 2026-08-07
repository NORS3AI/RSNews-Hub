import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { listAdvertisers } from '@/lib/adsServer';
import ArticleEditor from '@/components/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function NewArticle() {
  const [categories, polls, quizzes, advertisers, user] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, question: true } }),
    prisma.quiz.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }),
    listAdvertisers(),
    getCurrentUser(),
  ]);
  return <ArticleEditor categories={categories} polls={polls.map((p) => ({ id: p.id, title: p.question }))} quizzes={quizzes}
    advertisers={advertisers} authorName={user?.name || 'You'} />;
}
