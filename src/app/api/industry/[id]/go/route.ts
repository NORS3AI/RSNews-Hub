import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { CONSENT_KEY } from '@/lib/consent';

export const dynamic = 'force-dynamic';

// Counts a click-through, then redirects to the external source. The count is
// usage analytics, so it respects the reader's consent opt-out (cookie mirror of
// the ConsentBanner choice); the redirect itself always happens.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const link = await prisma.industryLink.findUnique({ where: { id: params.id } });
  if (!link) return NextResponse.redirect(new URL('/docs', req.url));
  const declined = (await cookies()).get(CONSENT_KEY)?.value === 'declined';
  if (!declined) {
    await prisma.industryLink.update({ where: { id: link.id }, data: { views: { increment: 1 } } }).catch(() => {});
  }
  const target = /^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`;
  return NextResponse.redirect(target, 302);
}
