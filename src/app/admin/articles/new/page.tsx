import Link from 'next/link';
import ArticleForm from '@/components/admin/ArticleForm';
import { listCategories } from '@/lib/articles';
import { createArticleAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default function NewArticlePage() {
  const categories = listCategories();
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/articles" className="text-sm text-slate-500 hover:text-slate-900">
          ← Articles
        </Link>
        <h1 className="mt-1 text-2xl font-black text-slate-900">New article</h1>
      </div>
      <ArticleForm action={createArticleAction} categories={categories} />
    </div>
  );
}
