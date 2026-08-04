import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Counts a click-through, then redirects to the external source.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const link = await prisma.industryLink.findUnique({ where: { id: params.id } });
  if (!link) return NextResponse.redirect(new URL('/docs', req.url));
  await prisma.industryLink.update({ where: { id: link.id }, data: { views: { increment: 1 } } }).catch(() => {});
  const target = /^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`;
  return NextResponse.redirect(target, 302);
}
