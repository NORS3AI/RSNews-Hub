import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import ArticleEditor from '@/components/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticle(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [article, categories] = await Promise.all([
    prisma.article.findUnique({ where: { id: params.id }, include: { tags: { select: { tag: { select: { name: true } } } }, extraCategories: { select: { id: true } } } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!article) notFound();
  return <ArticleEditor article={article as any} categories={categories} />;
}
