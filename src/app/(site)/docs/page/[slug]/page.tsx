import { notFound } from 'next/navigation';
import { getStaticPageData, getStaticPageMeta } from '@/lib/staticPageData';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const p = await getStaticPageMeta(params.slug);
  return { title: p ? p.title : 'Page' };
}

export default async function StaticPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = await getStaticPageData(params.slug);
  if (!page) notFound();
  return (
    <div className="container-reader py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
      <article className="prose-article mt-8" dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
