import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPageBySlug } from '@/lib/pages';
import { getCurrentUser, isStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  return { title: page ? page.title : 'Page' };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  const user = await getCurrentUser();

  if (!page) notFound();
  if (page.status !== 'published' && !isStaff(user)) notFound();

  return (
    <div className="container-rs py-8">
      <article className="mx-auto max-w-3xl">
        {page.status !== 'published' && (
          <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Preview — this page is <strong>{page.status}</strong>.
          </div>
        )}
        <h1 className="text-3xl font-black text-slate-900">{page.title}</h1>
        <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap">{page.body}</div>
      </article>
    </div>
  );
}
