import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { parseTree } from '@/lib/studio';
import { listAdvertisers } from '@/lib/adsServer';
import StudioEditor from '@/components/admin/studio/StudioEditor';

export const dynamic = 'force-dynamic';

export default async function StudioEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [mod, categories, advertisers] = await Promise.all([
    prisma.customModule.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { name: true, slug: true } }),
    listAdvertisers(),
  ]);
  if (!mod) notFound();
  return <StudioEditor id={mod.id} name={mod.name} published={mod.published} initialTree={parseTree(mod.tree)} categories={categories} advertisers={advertisers} />;
}
