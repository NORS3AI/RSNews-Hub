import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await prisma.page.findUnique({ where: { slug: params.slug } });
  return { title: p ? p.title : 'Page' };
}

export default async function StaticPage({ params }: { params: { slug: string } }) {
  const page = await prisma.page.findUnique({ where: { slug: params.slug } });
  if (!page || page.status !== 'PUBLISHED') notFound();
  return (
    <div className="container-reader py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
      <article className="prose-article mt-8" dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
