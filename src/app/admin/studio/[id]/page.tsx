import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { parseTree } from '@/lib/studio';
import StudioEditor from '@/components/admin/studio/StudioEditor';

export const dynamic = 'force-dynamic';

export default async function StudioEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mod = await prisma.customModule.findUnique({ where: { id } });
  if (!mod) notFound();
  return <StudioEditor id={mod.id} name={mod.name} published={mod.published} initialTree={parseTree(mod.tree)} />;
}
