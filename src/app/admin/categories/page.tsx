import { listArticles, listCategories, listTags } from '@/lib/articles';
import { createCategoryAction, deleteCategoryAction } from '../actions';

export const dynamic = 'force-dynamic';

export default function AdminCategoriesPage() {
  const categories = listCategories();
  const tags = listTags();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black text-slate-900">Categories &amp; Tags</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-900">
              Categories
            </div>
            {categories.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No categories yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {categories.map((c) => {
                  const count = listArticles({ categorySlug: c.slug, limit: 500 }).length;
                  return (
                    <li key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="font-medium text-slate-800">{c.name}</div>
                        {c.description && (
                          <div className="text-xs text-slate-500">{c.description}</div>
                        )}
                        <div className="text-xs text-slate-400">
                          /{c.slug} · {count} article{count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <form action={deleteCategoryAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="chip text-red-600 hover:bg-red-50">Delete</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {tags.length > 0 && (
            <div className="card mt-6 p-5">
              <div className="mb-3 font-semibold text-slate-900">Tags</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.id} className="chip">
                    #{t.name}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Tags are created automatically when you add them to an article.
              </p>
            </div>
          )}
        </div>

        <div>
          <form action={createCategoryAction} className="card space-y-4 p-5">
            <div className="font-semibold text-slate-900">New category</div>
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input className="input" id="name" name="name" required />
            </div>
            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea className="input" id="description" name="description" rows={3} />
            </div>
            <button className="btn-primary w-full">Add category</button>
          </form>
        </div>
      </div>
    </div>
  );
}
