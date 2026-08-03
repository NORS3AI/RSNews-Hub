import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import ArticleCard from '@/components/ArticleCard';
import { getCurrentUser } from '@/lib/auth';
import { getRecommendationsForUser } from '@/lib/articles';
import {
  getReadingHistory,
  getSubscribedArticles,
  getSubscribedCategories,
} from '@/lib/subscriptions';

export const metadata: Metadata = { title: 'My dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const subs = getSubscribedArticles(user.id);
  const subCats = getSubscribedCategories(user.id);
  const history = getReadingHistory(user.id, 10);
  const recommended = getRecommendationsForUser(user.id, 3);

  return (
    <div className="container-rs py-8">
      <h1 className="text-3xl font-black text-slate-900">Hi, {user.name.split(' ')[0]}</h1>
      <p className="mt-1 text-slate-500">Your subscriptions, reading history and recommendations.</p>

      {subCats.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Following:</span>
          {subCats.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="chip">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Subscribed articles</h2>
        {subs.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            You haven’t subscribed to anything yet.{' '}
            <Link href="/main" className="font-medium text-brand-700 hover:underline">
              Find something to read →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>

      {recommended.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Recommended for you</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Recently read</h2>
        {history.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">Nothing read yet.</div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {history.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/articles/${a.slug}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{a.title}</span>
                  {a.category_name && (
                    <span className="badge bg-brand-50 text-brand-700">{a.category_name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
