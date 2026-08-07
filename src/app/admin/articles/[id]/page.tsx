import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { listAdvertisers } from '@/lib/adsServer';
import ArticleEditor from '@/components/admin/ArticleEditor';
import ArticleRevisions from '@/components/admin/ArticleRevisions';

export const dynamic = 'force-dynamic';

export default async function EditArticle(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [article, categories, polls, quizzes, advertisers, revisions] = await Promise.all([
    prisma.article.findUnique({ where: { id: params.id }, include: { tags: { select: { tag: { select: { name: true } } } }, extraCategories: { select: { id: true } }, author: { select: { name: true } } } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, question: true } }),
    prisma.quiz.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }),
    listAdvertisers(),
    prisma.articleRevision.findMany({ where: { articleId: params.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, title: true, createdAt: true, author: { select: { name: true } } } }),
  ]);
  if (!article) notFound();
  return (
    <>
      <ArticleEditor article={article as any} categories={categories} polls={polls.map((p) => ({ id: p.id, title: p.question }))} quizzes={quizzes}
        advertisers={advertisers} authorName={(article as any).author?.name || 'You'} />
      <ArticleRevisions revisions={revisions.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt, authorName: r.author?.name ?? null }))} />
    </>
  );
}
