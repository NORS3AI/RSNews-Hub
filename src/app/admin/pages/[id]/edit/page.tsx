import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageForm from '@/components/admin/PageForm';
import { getPageById } from '@/lib/pages';
import { updatePageAction } from '../../../actions';

export const dynamic = 'force-dynamic';

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const page = getPageById(Number(id));
  if (!page) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/pages" className="text-sm text-slate-500 hover:text-slate-900">
            ← Pages
          </Link>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Edit page</h1>
        </div>
        {page.status === 'published' && (
          <Link href={`/p/${page.slug}`} className="btn-secondary" target="_blank">
            View live ↗
          </Link>
        )}
      </div>
      {saved && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Changes saved.
        </div>
      )}
      <PageForm action={updatePageAction} page={page} />
    </div>
  );
}
