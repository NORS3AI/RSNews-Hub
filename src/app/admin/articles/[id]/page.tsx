import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import ArticleEditor from '@/components/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticle(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [article, categories, polls, quizzes, ads] = await Promise.all([
    prisma.article.findUnique({ where: { id: params.id }, include: { tags: { select: { tag: { select: { name: true } } } }, extraCategories: { select: { id: true } }, author: { select: { name: true } } } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, question: true } }),
    prisma.quiz.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }),
    prisma.ad.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, brand: true, label: true } }),
  ]);
  if (!article) notFound();
  return <ArticleEditor article={article as any} categories={categories} polls={polls.map((p) => ({ id: p.id, title: p.question }))} quizzes={quizzes}
    ads={ads.map((a) => ({ id: a.id, title: a.label || a.brand }))} authorName={(article as any).author?.name || 'You'} />;
}
