import type { ArticleWithMeta, Category } from '@/lib/types';

export default function ArticleForm({
  action,
  categories,
  article,
}: {
  action: (formData: FormData) => void;
  categories: Category[];
  article?: ArticleWithMeta;
}) {
  const statuses: { value: string; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
    { value: 'trashed', label: 'Trashed' },
  ];

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {article && <input type="hidden" name="id" value={article.id} />}

      <div className="space-y-4 lg:col-span-2">
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input className="input" id="title" name="title" defaultValue={article?.title} required />
        </div>
        <div>
          <label className="label" htmlFor="excerpt">
            Excerpt / summary
          </label>
          <textarea
            className="input"
            id="excerpt"
            name="excerpt"
            rows={2}
            defaultValue={article?.excerpt}
            placeholder="A short summary shown in cards and search results."
          />
        </div>
        <div>
          <label className="label" htmlFor="body">
            Body
          </label>
          <textarea
            className="input font-mono text-sm"
            id="body"
            name="body"
            rows={18}
            defaultValue={article?.body}
            placeholder="Write your article here. Separate paragraphs with a blank line."
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-4 p-4">
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select className="input" id="status" name="status" defaultValue={article?.status || 'draft'}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category_id">
              Category
            </label>
            <select
              className="input"
              id="category_id"
              name="category_id"
              defaultValue={article?.category_id ?? ''}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tags">
              Tags
            </label>
            <input
              className="input"
              id="tags"
              name="tags"
              defaultValue={article?.tags.map((t) => t.name).join(', ')}
              placeholder="comma, separated, tags"
            />
          </div>
          <div>
            <label className="label" htmlFor="cover_image">
              Cover image URL
            </label>
            <input
              className="input"
              id="cover_image"
              name="cover_image"
              defaultValue={article?.cover_image}
              placeholder="https://…"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          {article ? 'Save changes' : 'Create article'}
        </button>
      </div>
    </form>
  );
}
