import { prisma } from '@/lib/db';
import ArticleEditor from '@/components/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function NewArticle() {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return <ArticleEditor categories={categories} />;
}
