import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleForm from '@/components/admin/ArticleForm';
import { getArticleById, listCategories } from '@/lib/articles';
import { updateArticleAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const article = getArticleById(Number(id));
  if (!article) notFound();
  const categories = listCategories();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/articles" className="text-sm text-slate-500 hover:text-slate-900">
            ← Articles
          </Link>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Edit article</h1>
        </div>
        {article.status === 'published' && (
          <Link href={`/articles/${article.slug}`} className="btn-secondary" target="_blank">
            View live ↗
          </Link>
        )}
      </div>

      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Changes saved.
        </div>
      )}

      <ArticleForm action={updateArticleAction} categories={categories} article={article} />
    </div>
  );
}
