import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import PageEditor from '@/components/admin/PageEditor';
export const dynamic = 'force-dynamic';
export default async function EditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) notFound();
  return <PageEditor page={page} />;
}
