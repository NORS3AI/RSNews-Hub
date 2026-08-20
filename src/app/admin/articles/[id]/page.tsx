import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { listAdvertisers, listReservedAds } from '@/lib/adsServer';
import ArticleEditor from '@/components/admin/ArticleEditor';
import ArticleRevisions from '@/components/admin/ArticleRevisions';
import ArticleReviews from '@/components/admin/ArticleReviews';
import VendorReviewPush from '@/components/admin/VendorReviewPush';
import { listArticlePushTrail } from '@/lib/vendorReview';

export const dynamic = 'force-dynamic';

export default async function EditArticle(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [article, categories, polls, quizzes, advertisers, reservedAds, revisions, reviews, vendors, pushTrail, bylines] = await Promise.all([
    prisma.article.findUnique({ where: { id: params.id }, include: { tags: { select: { tag: { select: { name: true } } } }, extraCategories: { select: { id: true } }, author: { select: { name: true } } } }),
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    prisma.poll.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, question: true } }),
    prisma.quiz.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true } }),
    listAdvertisers(),
    listReservedAds(),
    prisma.articleRevision.findMany({ where: { articleId: params.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, title: true, createdAt: true, author: { select: { name: true } } } }),
    prisma.articleReview.findMany({ where: { articleId: params.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    listArticlePushTrail(params.id),
    prisma.byline.findMany({ where: { archived: false }, orderBy: { name: 'asc' }, select: { id: true, name: true, title: true, photo: true } }),
  ]);
  if (!article) notFound();
  // If an autosaved draft exists, seed the editor from it (so an in-progress edit
  // resumes) instead of the live copy. The banner + Discard live in the editor.
  const a = article as any;
  const eff = a.draftSavedAt
    ? { ...a, title: a.draftTitle ?? a.title, content: a.draftContent ?? a.content, excerpt: a.draftExcerpt ?? a.excerpt, coverImage: a.draftCover ?? a.coverImage }
    : a;
  return (
    <>
      {/* Key on updatedAt + draftSavedAt so a Restore or Discard (which redirect
          back here) remounts the editor and re-seeds it — App Router otherwise
          preserves the TipTap client state across the redirect. */}
      <ArticleEditor key={`${a.id}:${new Date(a.updatedAt).getTime()}:${a.draftSavedAt ? new Date(a.draftSavedAt).getTime() : 0}`}
        article={eff} categories={categories} polls={polls.map((p) => ({ id: p.id, title: p.question }))} quizzes={quizzes}
        advertisers={advertisers} reservedAds={reservedAds} vendors={vendors} bylines={bylines} authorName={a.author?.name || 'You'} />
      <ArticleReviews
        articleId={a.id} slug={a.slug} previewToken={a.previewToken ?? null}
        reviews={reviews.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, decision: r.decision, message: r.message, resolved: r.resolved, createdAt: r.createdAt }))} />
      {(a.sponsorContactName || a.sponsorContactEmail) && (
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4 text-sm">
          <span className="font-semibold">Submitted by</span>{' '}
          <span>{a.sponsorContactName || 'Unknown'}</span>
          {a.sponsorContactEmail && <> · <a href={`mailto:${a.sponsorContactEmail}`} className="text-brand-600 hover:underline">{a.sponsorContactEmail}</a></>}
          <span className="ml-1 text-xs text-[var(--muted)]">— the contact archived with this article (who to reach about it).</span>
        </div>
      )}
      <VendorReviewPush articleId={a.id} vendors={vendors} defaultVendorId={a.sponsorVendorId ?? null}
        trail={pushTrail.map((t) => ({ id: t.id, createdAt: t.createdAt, vendorName: t.vendorName, decision: t.decision, decidedAt: t.decidedAt, message: t.message }))} />
      <ArticleRevisions revisions={revisions.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt, authorName: r.author?.name ?? null }))} />
    </>
  );
}
