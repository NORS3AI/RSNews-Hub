'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { reconcileArticleAudio, generateArticleAudio } from './articleAudio';
import { requireAdmin, hashPassword, getCurrentUser, getSessionUser } from './auth';
import { slugify, estimateReadMinutes, makeExcerpt, safeLinkHref } from './utils';
import { normalizeGenre } from './genre';
import { ensurePreviewToken } from './reviews';
import { resolveIntakeVendor, notifySponsorLive } from './intake';
import { recordVendorDecision } from './vendorReview';
import { CONTENT_STATUSES, USER_STATUSES, ROLES, ACCOUNT_TYPES } from './constants';
import { getHomeLayout, saveHomeLayout, getDraftLayout, saveDraftLayout, publishDraftLayout, discardDraftLayout, applyReorder, reorderLiveLayout, clampSpan, patchModuleLive, DEFAULT_LAYOUT, MODULE_CATALOG, type ModuleId } from './homepage';
import { parseQuizBlocks, resolveClosesAt } from './quiz';
import { rollupDays, recentDayKeys, pruneOldEvents } from './analytics/rollup';
import { sanitizeArticleHtml } from './sanitize';
import { createCampaign, assignAdsToFlight, scheduleFlight, pauseFlight, cancelCampaign } from './campaigns';
import { reactivateSavedSuppliers } from './suppliers';
import { generateReportDraft, updateReportSummary, publishReport, unpublishReport, quarterOf } from './reports';
import { markCampaignPaid, parseAmountToCents } from './payments';
import { updateVendorContact, vendorIdForBrand, isActiveVendor } from './vendors';
import { entitlementsOf, isVendor } from './entitlements';
import { AD_UPDATE_URL_KEY, REPORT_PERIODS } from './vendorReports';
import { EMAIL_TEMPLATES } from './emailTemplates';
import { setNewsletterEnabled } from './newsletter';
import { upsertAnnouncement, deleteAnnouncement, toggleStar as toggleAnnouncementStarLib, setLiveAnnouncement, setAnnouncementEnabled, type AnnouncementInput } from './announcement';
import { saveReportTemplate, renameReportTemplate, deleteReportTemplate } from './reportTemplates';
import { emptyTree, serializeTree, parseTree, isShape, type Shape } from './studio';
import { materializeModulePolls } from './studioPolls';

async function ensureStaff() {
  const u = await requireAdmin();
  if (!u) throw new Error('Not authorized');
  return u;
}
async function ensureAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== 'ADMIN') throw new Error('Admin only');
  return u;
}

/** Admin: turn the whole email-digest feature on or off. When off, no digests
 *  send and the reader subscribe UI hides the email option (on-site
 *  notifications keep working). */
export async function setDigestEnabled(on: boolean): Promise<void> {
  await ensureStaff();
  await setNewsletterEnabled(on);
  revalidatePath('/admin/subscribers');
}

/* --------------------- Announcement bar (library) ------------------------ */
// Save/edit/star/delete a message in the library, choose which is live, and the
// master on/off — all separate, so "save" never publishes or flips on/off.

export async function saveAnnouncementMessage(input: AnnouncementInput): Promise<string> {
  await ensureStaff();
  const id = await upsertAnnouncement(input);
  revalidatePath('/admin/announcement');
  return id;
}
export async function deleteAnnouncementMessage(id: string): Promise<void> {
  await ensureStaff();
  await deleteAnnouncement(id);
  revalidatePath('/admin/announcement');
}
export async function toggleAnnouncementStar(id: string): Promise<void> {
  await ensureStaff();
  await toggleAnnouncementStarLib(id);
  revalidatePath('/admin/announcement');
}
export async function showAnnouncementMessage(id: string): Promise<void> {
  await ensureStaff();
  await setLiveAnnouncement(id);
  revalidatePath('/admin/announcement');
}
export async function setAnnouncementBarEnabled(on: boolean): Promise<void> {
  await ensureStaff();
  await setAnnouncementEnabled(on);
  revalidatePath('/admin/announcement');
}

/* ------------------------------ Byline library ---------------------------- */
// Reusable author identities (photo + name + title). Saving/editing here updates
// every article that uses the byline (a title change, a new photo); archiving
// hides it from the picker without touching articles that already reference it.
export async function saveByline(input: { id?: string; name: string; title?: string | null; photo?: string | null; bio?: string | null }): Promise<string> {
  await ensureStaff();
  const name = (input.name ?? '').trim().slice(0, 120);
  if (!name) throw new Error('A byline needs a name.');
  const title = (input.title ?? '').trim().slice(0, 120) || null;
  const photo = (input.photo ?? '').trim().slice(0, 2000) || null;
  const bio = (input.bio ?? '').trim().slice(0, 600) || null;
  const row = input.id
    ? await prisma.byline.update({ where: { id: input.id }, data: { name, title, photo, bio } })
    : await prisma.byline.create({ data: { name, title, photo, bio } });
  revalidatePath('/admin/bylines');
  return row.id;
}
export async function setBylineArchived(id: string, archived: boolean): Promise<void> {
  await ensureStaff();
  await prisma.byline.update({ where: { id }, data: { archived } });
  revalidatePath('/admin/bylines');
}

/* --------------------- Report builder templates -------------------------- */
// Save/delete a named Report-builder configuration. A template stores only the
// querystring; regenerating always recomputes live numbers, so there's nothing
// to refresh — pressing a template just re-opens the builder with fresh data.

export async function saveReportTemplateAction(name: string, query: string): Promise<string> {
  await ensureStaff();
  const id = await saveReportTemplate(name, query);
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/builder');
  return id;
}
export async function renameReportTemplateAction(id: string, name: string): Promise<void> {
  await ensureStaff();
  await renameReportTemplate(id, name);
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/builder');
}
export async function deleteReportTemplateAction(id: string): Promise<void> {
  await ensureStaff();
  await deleteReportTemplate(id);
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/builder');
}

async function uniqueSlug(base: string, model: 'article' | 'page' | 'category' | 'tag', ignoreId?: string) {
  let slug = slugify(base) || 'untitled';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = await (prisma[model] as any).findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
}

/* ------------------------------- Articles ------------------------------- */

const ARTICLE_REVISION_MAX = 20; // per-article cap on stored revisions

export async function saveArticle(formData: FormData) {
  const staff = await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  // Sanitize editor HTML on write — strips scripts/handlers/inline styles so a
  // lower-trust EDITOR can't plant stored XSS. See lib/sanitize.ts.
  const content = sanitizeArticleHtml(((formData.get('content') as string) || '').trim());
  const status = (formData.get('status') as string) || 'DRAFT';
  const categoryId = (formData.get('categoryId') as string) || '';
  const coverImage = ((formData.get('coverImage') as string) || '').trim();
  const coverVideo = ((formData.get('coverVideo') as string) || '').trim();
  // Focal point: accept only the 9 known object-position values; anything else
  // (incl. a forged value) → null (center). Defense-in-depth so the value can
  // never be a surprise if it's ever interpolated into a raw style string.
  const COVER_FOCUS_OK = new Set(['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%']);
  const coverFocusRaw = ((formData.get('coverFocus') as string) || '').trim();
  const coverFocus = COVER_FOCUS_OK.has(coverFocusRaw) ? coverFocusRaw : '';
  const featured = formData.get('featured') === 'on';
  const pinned = formData.get('pinned') === 'on';
  // Access gate token; normalize 'public' → '' (open) and lowercase for matching.
  const requirementRaw = ((formData.get('requirement') as string) || '').trim().toLowerCase();
  const requirement = requirementRaw === 'public' ? '' : requirementRaw;
  // Optional editorial genre — whitelisted to a known token or '' (none).
  const genre = normalizeGenre(formData.get('genre'));
  // Optional connected vendor (the advertiser this piece belongs to — sponsored or
  // a What's Hot article). Verified to be a real vendor id, else cleared. Drives the
  // in-article ad lock + the "send to dashboard" default. '' → null (not connected).
  // ADMIN-ONLY to change: connecting a piece to a vendor triggers a go-live email to
  // that vendor's contact and locks the article's ads to their brand, so a lower-trust
  // EDITOR must not be able to point an article at an arbitrary (e.g. competitor)
  // premium vendor — the same rule confirmIntakeVendor enforces. Editors keep the
  // existing connection untouched (resolved per create/edit branch below).
  const isAdmin = staff.role === 'ADMIN';
  const sponsorVendorIdRaw = ((formData.get('sponsorVendorId') as string) || '').trim();
  const sponsorVendorId = sponsorVendorIdRaw
    ? (await prisma.vendor.findUnique({ where: { id: sponsorVendorIdRaw }, select: { id: true } }))?.id ?? null
    : null;
  const excerptInput = ((formData.get('excerpt') as string) || '').trim();
  // Byline: a chosen library byline (photo + name + title) wins; the free-text
  // field is a one-off name (or empty → the house team default). Validate the id
  // so a stale reference can't FK-error the save; unknown → treated as none.
  const bylineIdRaw = ((formData.get('bylineId') as string) || '').trim();
  const bylineId = bylineIdRaw
    ? (await prisma.byline.findUnique({ where: { id: bylineIdRaw }, select: { id: true } }))?.id ?? null
    : null;
  const byline = ((formData.get('byline') as string) || '').trim().slice(0, 120);
  const tagsRaw = ((formData.get('tags') as string) || '').trim();
  const publishedAtRaw = ((formData.get('publishedAt') as string) || '').trim();
  const publishedAtInput = publishedAtRaw ? new Date(publishedAtRaw) : null;
  const hasPubDate = !!publishedAtInput && !isNaN(publishedAtInput.getTime());

  if (!title || !content) throw new Error('Title and content are required');
  if (!CONTENT_STATUSES.includes(status as any)) throw new Error('Invalid status');

  const excerpt = excerptInput || makeExcerpt(content);
  const readMinutes = estimateReadMinutes(content);

  // Resolve tags: comma-separated names, created on the fly.
  const tagNames = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await prisma.tag.upsert({ where: { slug }, update: {}, create: { name, slug } });
    tagIds.push(tag.id);
  }

  const nowPublished = status === 'PUBLISHED';

  // Additional categories (M2M), minus the primary so it isn't duplicated.
  const extraCategoryIds = [...new Set((formData.getAll('extraCategoryIds') as string[]).map(String).filter(Boolean))].filter((cid) => cid !== categoryId);
  // Breaking timer: 'keep' → leave as-is (undefined), '' → clear, else hours from now.
  const breakingRaw = ((formData.get('breakingHours') as string) || '').trim();
  let breakingUntil: Date | null | undefined;
  if (breakingRaw === 'keep') breakingUntil = undefined;
  else if (breakingRaw === '') breakingUntil = null;
  else {
    const hours = breakingRaw === 'custom' ? Number(formData.get('breakingCustomHours')) : Number(breakingRaw);
    breakingUntil = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 365) * 3600 * 1000) : null;
  }
  // Sponsored/Featured window end. Blank → null (not sponsored). Any valid date
  // is accepted (an admin may set a past date to end a run early).
  const sponsoredRaw = ((formData.get('sponsoredUntil') as string) || '').trim();
  const sponsoredUntil = sponsoredRaw ? (isNaN(new Date(sponsoredRaw).getTime()) ? null : new Date(sponsoredRaw)) : null;

  let savedId = id;
  if (id) {
    const existing = await prisma.article.findUnique({ where: { id }, select: { publishedAt: true, status: true, title: true, content: true, excerpt: true, authorId: true, slug: true, sponsorVendorId: true } });
    if (!existing) throw new Error('Article not found');
    // Editors can't change the vendor connection — keep whatever's already set.
    const sponsorVendorIdResolved = isAdmin ? sponsorVendorId : existing.sponsorVendorId;
    // Snapshot the prior version before overwriting — only when the body actually
    // changed — so an editor can roll back. Capped per article.
    if (existing.content !== content) {
      await prisma.articleRevision.create({ data: { articleId: id, title: existing.title, content: existing.content, excerpt: existing.excerpt, authorId: existing.authorId } });
      const extra = await prisma.articleRevision.findMany({ where: { articleId: id }, orderBy: { createdAt: 'desc' }, skip: ARTICLE_REVISION_MAX, select: { id: true } });
      if (extra.length) await prisma.articleRevision.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    }
    // Keep the existing slug stable on edit — renaming the title must NOT change
    // a live article's URL (would break bookmarks, shares, SEO, saved-item links).
    // A new slug is only minted if the article somehow has none yet.
    const slug = existing.slug || await uniqueSlug(title, 'article', id);
    await prisma.article.update({
      where: { id },
      data: {
        title, slug, content, excerpt, byline: byline || null, bylineId, coverImage: coverImage || null, coverVideo: coverVideo || null, coverFocus: coverFocus || null, status, requirement, genre, sponsoredUntil, sponsorVendorId: sponsorVendorIdResolved, featured, pinned, readMinutes,
        categoryId: categoryId || null,
        extraCategories: { set: extraCategoryIds.map((cid) => ({ id: cid })) },
        breakingUntil, // undefined leaves it unchanged (Prisma ignores undefined)
        // Explicit date wins (backdate or schedule); otherwise keep existing or stamp now on publish.
        publishedAt: hasPubDate ? publishedAtInput : (nowPublished ? existing.publishedAt ?? new Date() : existing.publishedAt),
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
        // A deliberate Save supersedes any autosaved draft — clear it.
        draftTitle: null, draftContent: null, draftExcerpt: null, draftCover: null, draftSavedAt: null,
      },
    });
  } else {
    const slug = await uniqueSlug(title, 'article');
    const created = await prisma.article.create({
      data: {
        title, slug, content, excerpt, byline: byline || null, bylineId, coverImage: coverImage || null, coverVideo: coverVideo || null, coverFocus: coverFocus || null, status, requirement, genre, sponsoredUntil, sponsorVendorId: isAdmin ? sponsorVendorId : null, featured, pinned, readMinutes,
        categoryId: categoryId || null, authorId: staff.id,
        extraCategories: { connect: extraCategoryIds.map((cid) => ({ id: cid })) },
        breakingUntil: breakingUntil ?? null,
        publishedAt: hasPubDate ? publishedAtInput : (nowPublished ? new Date() : null),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    savedId = created.id;
  }

  // "Listen to article" audio: flag it for (re)generation if the spoken text
  // changed, then synthesize in the background so the save isn't blocked. No-ops
  // safely when ElevenLabs isn't configured.
  if (savedId) {
    try {
      await reconcileArticleAudio(savedId);
      const audioId = savedId;
      after(() => generateArticleAudio(audioId).catch(() => {}));
    } catch { /* never let audio break a save */ }
  }

  // Stage-two intake notify: when a sponsored, vendor-linked article first goes
  // live, tell the vendor (premium → email push; else copy-paste note for the
  // admin). notifySponsorLive self-guards on sponsorNotifiedAt + PUBLISHED, so
  // this is a no-op for ordinary articles and for re-saves of an already-live one.
  if (savedId && nowPublished) {
    const liveId = savedId;
    after(() => notifySponsorLive(liveId).catch(() => {}));
  }

  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  revalidateTag('reader-content'); // refresh cached category/tag/list pages now
  redirect('/admin/articles');
}

/** Admin: confirm which vendor a held sponsored-intake submission belongs to
 *  (confirm-before-merge), binding the draft article to it. `vendorId` is an
 *  existing vendor id or the literal 'new' to create one from the submitted name.
 *  ADMIN-only (not EDITOR): binding a sponsor to a vendor drives the go-live
 *  email + sponsorship attribution, so a lower-trust editor must not be able to
 *  re-point a draft to an arbitrary (e.g. competitor) premium vendor. */
export async function confirmIntakeVendor(formData: FormData) {
  await ensureAdmin();
  const submissionId = String(formData.get('submissionId') || '').trim();
  const vendorId = String(formData.get('vendorId') || '').trim();
  if (!submissionId || !vendorId) throw new Error('Pick a vendor to confirm.');
  await resolveIntakeVendor(submissionId, vendorId);
  revalidatePath('/admin/intake');
}

/** Admin: push an article to a vendor's dashboard for review. Each call is a NEW
 *  round (a fresh pending item + a timestamped paper-trail row); a re-push after
 *  edits does not disturb earlier rounds. Ensures a preview token so the vendor can
 *  see the draft. Works for sponsored articles and What's Hot pieces.
 *  ADMIN-only (not EDITOR): pushing shares a private draft-preview link with an
 *  external vendor, so — like confirmIntakeVendor — a lower-trust editor must not be
 *  able to leak an arbitrary draft to an arbitrary advertiser. */
export async function pushArticleToVendorReview(formData: FormData) {
  await ensureAdmin();
  const articleId = String(formData.get('articleId') || '').trim();
  const vendorId = String(formData.get('vendorId') || '').trim();
  if (!articleId || !vendorId) throw new Error('Pick a vendor to send this to.');
  const [article, vendor] = await Promise.all([
    prisma.article.findUnique({ where: { id: articleId }, select: { id: true } }),
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }),
  ]);
  if (!article) throw new Error('Article not found');
  if (!vendor) throw new Error('Vendor not found');
  await ensurePreviewToken(articleId); // so the vendor can preview the draft on their dashboard
  await prisma.vendorReviewRequest.create({ data: { articleId, vendorId } });
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath('/docs/vendor');
}

/** Vendor: answer a review pushed to their dashboard — Approve or Request changes,
 *  ONCE. The decision locks the row (no reopen/flip) and is mirrored into the admin
 *  Hub feedback (an ArticleReview) so it shows alongside link-reviewer responses. */
export async function submitVendorReviewDecision(formData: FormData) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  const requestId = String(formData.get('requestId') || '').trim();
  const decision = String(formData.get('decision') || '').trim();
  const message = String(formData.get('message') || '').trim().slice(0, 5000);
  if (!requestId || (decision !== 'approve' && decision !== 'change')) throw new Error('Choose approve or request changes.');
  if (decision === 'change' && !message) throw new Error('Add a note describing the changes you’d like.');

  const req = await prisma.vendorReviewRequest.findUnique({ where: { id: requestId }, select: { vendorId: true, articleId: true } });
  if (!req) throw new Error('Review not found');
  // Ownership: the signed-in account must BE this vendor.
  const ent = entitlementsOf(u);
  if (!isVendor(ent)) throw new Error('This review is for the advertiser.');
  // Coupled to the premium switch: a de-listed vendor can't act on reviews either.
  if (!(await isActiveVendor(u))) throw new Error('The advertiser dashboard is available to active premium suppliers only.');
  const myVendorId = await vendorIdForBrand(ent.vendorBrand);
  if (!myVendorId || myVendorId !== req.vendorId) throw new Error('This review isn’t yours.');

  // Atomic lock + mirror into the admin Hub. Only the first response wins.
  const vendor = await prisma.vendor.findUnique({ where: { id: req.vendorId }, select: { name: true } });
  const ok = await recordVendorDecision({
    requestId, articleId: req.articleId, decision, message,
    firstName: u.name || vendor?.name || 'Vendor',
    lastName: `(${vendor?.name || 'vendor'})`,
  });
  if (!ok) throw new Error('You’ve already responded to this review.');
  revalidatePath('/docs/vendor');
  revalidatePath(`/admin/articles/${req.articleId}`);
}

// Background autosave for an article being edited. Persists the easily-lost work
// (title + body + excerpt + cover) WITHOUT touching status or publishedAt — an
// autosave never publishes, never reschedules, and never navigates. Only updates
// an existing article; brand-new drafts are still protected by the unsaved-changes
// guard until their first manual Save. Returns a timestamp for the "Autosaved …"
// indicator. Never throws for the client — returns ok:false instead.
export async function autosaveArticle(formData: FormData): Promise<{ ok: boolean; at: number }> {
  const now = Date.now();
  try {
    await ensureStaff();
    const id = (formData.get('id') as string) || '';
    if (!id) return { ok: false, at: now };
    const title = ((formData.get('title') as string) || '').trim();
    const content = sanitizeArticleHtml(((formData.get('content') as string) || '').trim());
    if (!title && !content) return { ok: false, at: now };
    const coverImage = ((formData.get('coverImage') as string) || '').trim();
    const excerptInput = ((formData.get('excerpt') as string) || '').trim();

    const existing = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { ok: false, at: now };
    // Write to the DRAFT columns only — never the live content. Safe for any
    // status (a PUBLISHED article's readers keep seeing the saved version until a
    // deliberate Save promotes the draft). The editor loads these back on reopen.
    await prisma.article.update({
      where: { id },
      data: {
        draftTitle: title || null,
        draftContent: content || null,
        draftExcerpt: excerptInput || (content ? makeExcerpt(content) : null),
        draftCover: coverImage || null,
        draftSavedAt: new Date(),
      },
    });
    return { ok: true, at: Date.now() };
  } catch {
    return { ok: false, at: now };
  }
}

// Throw away an article's autosaved draft, so the editor reloads the live copy.
export async function discardDraft(id: string) {
  await ensureStaff();
  if (!id) return;
  await prisma.article.update({
    where: { id },
    data: { draftTitle: null, draftContent: null, draftExcerpt: null, draftCover: null, draftSavedAt: null },
  });
  revalidatePath('/admin/articles');
  redirect(`/admin/articles/${id}`);
}

// Roll an article back to a stored revision. The current version is snapshotted
// first (so a restore is itself undoable), then the article's title/body/excerpt
// are replaced. Status and publish date are left untouched.
export async function restoreArticleRevision(revisionId: string) {
  await ensureStaff();
  const rev = await prisma.articleRevision.findUnique({ where: { id: revisionId } });
  if (!rev) throw new Error('Revision not found');
  const current = await prisma.article.findUnique({ where: { id: rev.articleId }, select: { title: true, content: true, excerpt: true, authorId: true } });
  if (!current) throw new Error('Article not found');
  if (current.content !== rev.content) {
    await prisma.articleRevision.create({ data: { articleId: rev.articleId, title: current.title, content: current.content, excerpt: current.excerpt, authorId: current.authorId } });
    const extra = await prisma.articleRevision.findMany({ where: { articleId: rev.articleId }, orderBy: { createdAt: 'desc' }, skip: ARTICLE_REVISION_MAX, select: { id: true } });
    if (extra.length) await prisma.articleRevision.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
  }
  await prisma.article.update({
    where: { id: rev.articleId },
    data: { title: rev.title, content: rev.content, excerpt: rev.excerpt || makeExcerpt(rev.content), readMinutes: estimateReadMinutes(rev.content) },
  });
  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  revalidateTag('reader-content');
  // Navigate back to the editor so it remounts with the restored content.
  redirect(`/admin/articles/${rev.articleId}`);
}

export async function setArticleStatus(id: string, status: string) {
  await ensureStaff();
  if (!CONTENT_STATUSES.includes(status as any)) throw new Error('Invalid status');
  const existing = await prisma.article.findUnique({ where: { id }, select: { publishedAt: true } });
  await prisma.article.update({
    where: { id },
    data: { status, publishedAt: status === 'PUBLISHED' ? existing?.publishedAt ?? new Date() : existing?.publishedAt },
  });
  // Publishing from the list quick-action must fire the sponsor go-live notify too
  // (same as the full editor's saveArticle). notifySponsorLive self-guards on
  // genre/sponsorVendorId/sponsorNotifiedAt, so it's a no-op for ordinary articles.
  if (status === 'PUBLISHED') after(() => notifySponsorLive(id).catch(() => {}));
  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  revalidateTag('reader-content');
}

export async function deleteArticle(id: string) {
  await ensureStaff();
  await prisma.article.delete({ where: { id } });
  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  revalidateTag('reader-content');
}

/* ------------------------------- Categories ------------------------------ */

export async function saveCategory(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const name = ((formData.get('name') as string) || '').trim();
  const description = ((formData.get('description') as string) || '').trim();
  const color = ((formData.get('color') as string) || '#316bff').trim();
  if (!name) throw new Error('Name required');
  const slug = await uniqueSlug(name, 'category', id || undefined);
  if (id) await prisma.category.update({ where: { id }, data: { name, slug, description: description || null, color } });
  else await prisma.category.create({ data: { name, slug, description: description || null, color } });
  revalidatePath('/admin/categories');
  revalidatePath('/docs/categories');
  revalidatePath('/docs');
  revalidateTag('reader-content');
}

export async function deleteCategory(id: string) {
  await ensureStaff();
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
  revalidatePath('/docs/categories');
  revalidatePath('/docs');
  revalidateTag('reader-content');
}

/* ----------------------------- Ad management ----------------------------- */

export async function saveAd(formData: FormData) {
  const staff = await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const brand = ((formData.get('brand') as string) || '').trim();
  const headline = ((formData.get('headline') as string) || '').trim();
  const label = ((formData.get('label') as string) || '').trim();
  const cta = ((formData.get('cta') as string) || '').trim() || 'Learn more';
  // Only http(s) or a site-relative path — never javascript:/data:/'//host'.
  const href = safeLinkHref(formData.get('href'), '#');
  const accent = ((formData.get('accent') as string) || '').trim() || '#E97D34';
  const keywords = ((formData.get('keywords') as string) || '').trim();
  const competitors = ((formData.get('competitors') as string) || '').trim();
  const imageWide = ((formData.get('imageWide') as string) || '').trim();
  const imageRect = ((formData.get('imageRect') as string) || '').trim();
  const imageTall = ((formData.get('imageTall') as string) || '').trim();
  const video = ((formData.get('video') as string) || '').trim();
  const videoPoster = ((formData.get('videoPoster') as string) || '').trim();
  const active = formData.get('active') != null;
  // Reserved = a hand-placed one-off; kept out of rotation (see loadAds).
  // House = an RS-owned creative; the ONLY safe fallback inside a vendor-locked
  // article (see pickInArticleAd). Never set this on an outside advertiser's ad.
  // BOTH are cross-vendor-safety flags → ADMIN-only: a lower-trust EDITOR must not
  // be able to flag an outside advertiser as `house` (which could then surface
  // inside a competitor's locked article). Editors keep whatever's already set.
  const isAdmin = staff.role === 'ADMIN';
  let reserved = formData.get('reserved') != null;
  let house = formData.get('house') != null;
  if (!isAdmin) {
    const cur = id ? await prisma.ad.findUnique({ where: { id }, select: { reserved: true, house: true } }) : null;
    reserved = cur?.reserved ?? false;
    house = cur?.house ?? false;
  }
  const parseDate = (v: string) => { const s = (v || '').trim(); if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const liveFrom = parseDate(formData.get('liveFrom') as string);
  const liveUntil = parseDate(formData.get('liveUntil') as string);
  if (!brand || !headline) throw new Error('Brand and headline are required');
  const data = { brand, headline, label: label || null, cta, href, accent, keywords, competitors, imageWide: imageWide || null, imageRect: imageRect || null, imageTall: imageTall || null, video: video || null, videoPoster: videoPoster || null, active, reserved, house, liveFrom, liveUntil };
  if (id) await prisma.ad.update({ where: { id }, data });
  else await prisma.ad.create({ data });
  revalidatePath('/admin/ads');
  revalidatePath('/docs');
}

/* ------------------- Draft preview links + approvals --------------------- */

/** Generate (once) + return the article's private preview token. Staff only. */
export async function ensureArticlePreviewLink(articleId: string): Promise<string> {
  await ensureStaff();
  return ensurePreviewToken(articleId);
}
/** Mark a change request handled so it stops holding "Changes requested". */
export async function resolveArticleReview(id: string): Promise<void> {
  await ensureStaff();
  await prisma.articleReview.updateMany({ where: { id }, data: { resolved: true } });
}
export async function deleteArticleReview(id: string): Promise<void> {
  await ensureStaff();
  await prisma.articleReview.deleteMany({ where: { id } });
}

export async function deleteAd(id: string) {
  await ensureStaff();
  await prisma.ad.delete({ where: { id } });
  revalidatePath('/admin/ads');
  revalidatePath('/docs');
}

// One-click fix when the auto-slotter guessed wrong on an import: swap the wide
// banner and rectangle images.
export async function swapAdImages(id: string) {
  await ensureStaff();
  const ad = await prisma.ad.findUnique({ where: { id }, select: { imageWide: true, imageRect: true } });
  if (!ad) return;
  await prisma.ad.update({ where: { id }, data: { imageWide: ad.imageRect, imageRect: ad.imageWide } });
  revalidatePath('/admin/ads');
  revalidatePath('/docs');
}

export async function toggleAd(id: string, active: boolean) {
  await ensureStaff();
  await prisma.ad.update({ where: { id }, data: { active } });
  revalidatePath('/admin/ads');
  revalidatePath('/docs');
}

/* ----------------------------- Industry News ----------------------------- */

export async function saveIndustryLink(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  const url = ((formData.get('url') as string) || '').trim();
  const source = ((formData.get('source') as string) || '').trim();
  const author = ((formData.get('author') as string) || '').trim() || 'Brandon Gale';
  const order = parseInt((formData.get('order') as string) || '0', 10) || 0;
  const active = formData.get('active') != null;
  const postedRaw = ((formData.get('postedAt') as string) || '').trim();
  if (!title || !url) throw new Error('Title and URL are required');
  const data: { title: string; url: string; source: string | null; author: string; order: number; active: boolean; postedAt?: Date } =
    { title, url, source: source || null, author, order, active };
  const posted = postedRaw ? new Date(postedRaw) : null;
  if (posted && !isNaN(posted.getTime())) data.postedAt = posted;
  if (id) await prisma.industryLink.update({ where: { id }, data });
  else await prisma.industryLink.create({ data });
  revalidatePath('/admin/industry');
  revalidatePath('/docs');
}

export async function deleteIndustryLink(id: string) {
  await ensureStaff();
  await prisma.industryLink.delete({ where: { id } });
  revalidatePath('/admin/industry');
  revalidatePath('/docs');
}

/* -------------------------------- Polls ---------------------------------- */

// Returns the new poll's id/name so the client can offer to place it on the
// homepage (the auto-plug dialog). Returns {ok:false,error} instead of throwing
// on validation so the client form can show the message inline.
export async function createPoll(formData: FormData): Promise<{ ok: boolean; id?: string; name?: string; error?: string }> {
  await ensureStaff();
  const question = ((formData.get('question') as string) || '').trim();
  const optionsRaw = ((formData.get('options') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const options = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (!question || options.length < 2) return { ok: false, error: 'A question and at least 2 options are required' };
  const closes = closesRaw ? new Date(closesRaw) : null;
  // Polls are a library now — multiple can be active at once (each poll element
  // picks one). The council aside simply shows the most recent active poll.
  const poll = await prisma.poll.create({
    data: { question, active, kind: 'council', closesAt: closes && !isNaN(closes.getTime()) ? closes : null,
      options: { create: options.map((label, i) => ({ label, order: i })) } },
  });
  revalidatePath('/admin/polls');
  revalidatePath('/docs');
  return { ok: true, id: poll.id, name: question };
}

export async function updatePoll(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const question = ((formData.get('question') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const closes = closesRaw ? new Date(closesRaw) : null;
  if (!question) throw new Error('Question is required');

  // Non-destructive option editing. Each submitted row carries its existing
  // option id (or blank for a new one). Editing a label keeps the same row, so
  // its votes are preserved; new rows are created; a row that was removed is
  // deleted ONLY when it has zero votes — we never silently drop a real tally.
  const ids = formData.getAll('optId').map(String);
  const labels = formData.getAll('optLabel').map((v) => String(v).trim());
  const rows = labels.map((label, i) => ({ id: ids[i] || '', label })).filter((r) => r.label).slice(0, 8);
  if (rows.length < 2) throw new Error('A poll needs at least 2 options');

  const existing = await prisma.pollOption.findMany({ where: { pollId: id }, select: { id: true, votes: true } });
  // Only ids that actually belong to THIS poll may be updated — a client id that
  // isn't ours is treated as a new option, never used to write another poll's row.
  const ownIds = new Set(existing.map((o) => o.id));
  const keptIds = new Set(rows.filter((r) => r.id && ownIds.has(r.id)).map((r) => r.id));

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.poll.update({ where: { id }, data: { question, active, closesAt: closes && !isNaN(closes.getTime()) ? closes : null } }),
  ];
  rows.forEach((r, i) => {
    if (r.id && ownIds.has(r.id)) ops.push(prisma.pollOption.update({ where: { id: r.id }, data: { label: r.label.slice(0, 200), order: i } }));
    else ops.push(prisma.pollOption.create({ data: { pollId: id, label: r.label.slice(0, 200), order: i } }));
  });
  existing.filter((o) => !keptIds.has(o.id) && o.votes === 0).forEach((o) => ops.push(prisma.pollOption.delete({ where: { id: o.id } })));
  await prisma.$transaction(ops);

  revalidatePath('/admin/polls');
  revalidatePath('/docs');
}

export async function deletePoll(id: string) {
  await ensureStaff();
  await prisma.poll.delete({ where: { id } });
  revalidatePath('/admin/polls');
  revalidatePath('/docs');
}

/* -------------------------------- Pop Quiz -------------------------------- */

export async function createQuiz(formData: FormData): Promise<{ ok: boolean; id?: string; name?: string; error?: string }> {
  await ensureStaff();
  const title = ((formData.get('title') as string) || '').trim();
  const body = ((formData.get('questions') as string) || '').trim();
  const active = formData.get('active') != null;
  const hoursRaw = ((formData.get('hours') as string) || '').trim();
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const questions = parseQuizBlocks(body);
  if (!title || questions.length < 1) return { ok: false, error: 'A title and at least one question (each with 2+ options) are required' };

  // Timer: an explicit close time wins; otherwise now + N hours (default 48).
  const closesAt = resolveClosesAt({ explicit: closesRaw ? new Date(closesRaw) : null, hours: hoursRaw ? Number(hoursRaw) : null });

  // Retire the previous active quiz and create the new one in ONE transaction so
  // a failure can't leave the site with zero (or, under a race, two) active
  // quizzes — mirroring updateQuiz.
  const quiz = await prisma.$transaction(async (tx) => {
    if (active) await tx.quiz.updateMany({ where: { active: true }, data: { active: false } });
    return tx.quiz.create({
      data: {
        title, active, closesAt,
        questions: {
          create: questions.map((q, qi) => ({
            prompt: q.prompt, order: qi,
            options: { create: q.options.map((o, oi) => ({ label: o.label, correct: o.correct, order: oi })) },
          })),
        },
      },
    });
  });
  revalidatePath('/admin/quizzes');
  revalidatePath('/docs');
  return { ok: true, id: quiz.id, name: title };
}

type EditQuizOption = { id: string; label: string; correct: boolean };
type EditQuizQuestion = { id: string; prompt: string; options: EditQuizOption[] };

export async function updateQuiz(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  if (!title) throw new Error('Title is required');
  const closes = closesRaw ? new Date(closesRaw) : null;

  // Structured, non-destructive edit. The client sends the full question/option
  // tree as JSON; existing rows keep their id so their response counts survive.
  // New rows have a blank id (created); rows dropped in the editor are deleted
  // only when they have zero responses — a real tally is never discarded.
  let raw: unknown = [];
  try { raw = JSON.parse((formData.get('payload') as string) || '[]'); } catch { raw = []; }
  const questions: EditQuizQuestion[] = (Array.isArray(raw) ? raw : []).map((q) => {
    const qq = q as Record<string, unknown>;
    return {
      id: typeof qq.id === 'string' ? qq.id : '',
      prompt: String(qq.prompt || '').trim(),
      options: (Array.isArray(qq.options) ? qq.options : []).map((o) => {
        const oo = o as Record<string, unknown>;
        return { id: typeof oo.id === 'string' ? oo.id : '', label: String(oo.label || '').trim(), correct: !!oo.correct };
      }).filter((o) => o.label).slice(0, 8),
    };
  }).filter((q) => q.prompt && q.options.length >= 2).slice(0, 20);
  if (questions.length < 1) throw new Error('A quiz needs at least one question with 2+ options');

  const existing = await prisma.quizQuestion.findMany({
    where: { quizId: id },
    include: { options: { select: { id: true, count: true } } },
  });
  // Map each of THIS quiz's question ids → its own option ids. Only ids in here
  // may be updated/deleted; any other client-supplied id is treated as new, so a
  // crafted request can never rewrite another quiz's questions or answers.
  const ownQ = new Map(existing.map((e) => [e.id, new Set(e.options.map((o) => o.id))]));
  const keptQ = new Set(questions.filter((q) => q.id && ownQ.has(q.id)).map((q) => q.id));

  await prisma.$transaction(async (tx) => {
    // Retire other active quizzes inside the tx, so a failure can't leave zero active.
    if (active) await tx.quiz.updateMany({ where: { active: true, id: { not: id } }, data: { active: false } });
    await tx.quiz.update({ where: { id }, data: { title, active, ...(closes && !isNaN(closes.getTime()) ? { closesAt: closes } : {}) } });

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const ownO = q.id ? ownQ.get(q.id) : undefined;
      if (q.id && ownO) {
        await tx.quizQuestion.update({ where: { id: q.id }, data: { prompt: q.prompt.slice(0, 300), order: qi } });
        const keptO = new Set(q.options.filter((o) => o.id && ownO.has(o.id)).map((o) => o.id));
        for (let oi = 0; oi < q.options.length; oi++) {
          const o = q.options[oi];
          if (o.id && ownO.has(o.id)) await tx.quizOption.update({ where: { id: o.id }, data: { label: o.label.slice(0, 200), correct: o.correct, order: oi } });
          else await tx.quizOption.create({ data: { questionId: q.id, label: o.label.slice(0, 200), correct: o.correct, order: oi } });
        }
        const existOpts = existing.find((e) => e.id === q.id)?.options ?? [];
        for (const eo of existOpts) {
          if (!keptO.has(eo.id) && eo.count === 0) await tx.quizOption.delete({ where: { id: eo.id } });
        }
      } else {
        await tx.quizQuestion.create({
          data: { quizId: id, prompt: q.prompt.slice(0, 300), order: qi,
            options: { create: q.options.map((o, oi) => ({ label: o.label.slice(0, 200), correct: o.correct, order: oi })) } },
        });
      }
    }
    // Drop questions removed in the editor — only when they hold no responses.
    for (const eq of existing) {
      const answered = eq.options.some((o) => o.count > 0);
      if (!keptQ.has(eq.id) && !answered) await tx.quizQuestion.delete({ where: { id: eq.id } });
    }
  });

  revalidatePath('/admin/quizzes');
  revalidatePath('/docs');
}

export async function deleteQuiz(id: string) {
  await ensureStaff();
  await prisma.quiz.delete({ where: { id } });
  revalidatePath('/admin/quizzes');
  revalidatePath('/docs');
}

/* -------------------------------- Comics --------------------------------- */

export async function saveComic(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  const image = ((formData.get('image') as string) || '').trim();
  const caption = ((formData.get('caption') as string) || '').trim();
  const active = formData.get('active') != null;
  const postedRaw = ((formData.get('postedAt') as string) || '').trim();
  if (!title || !image) throw new Error('A title and image are required');
  const data: { title: string; image: string; caption: string | null; active: boolean; postedAt?: Date } =
    { title, image, caption: caption || null, active };
  const posted = postedRaw ? new Date(postedRaw) : null;
  if (posted && !isNaN(posted.getTime())) data.postedAt = posted;
  if (id) await prisma.comic.update({ where: { id }, data });
  else await prisma.comic.create({ data });
  revalidatePath('/admin/comics');
  revalidatePath('/docs');
}

export async function toggleComic(id: string, active: boolean) {
  await ensureStaff();
  await prisma.comic.update({ where: { id }, data: { active } });
  revalidatePath('/admin/comics');
  revalidatePath('/docs');
}

export async function deleteComic(id: string) {
  await ensureStaff();
  await prisma.comic.delete({ where: { id } });
  revalidatePath('/admin/comics');
  revalidatePath('/docs');
}

/* --------------------------------- Tags ---------------------------------- */

export async function saveTag(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const name = ((formData.get('name') as string) || '').trim();
  if (!name) throw new Error('Name required');
  const slug = await uniqueSlug(name, 'tag', id || undefined);
  if (id) await prisma.tag.update({ where: { id }, data: { name, slug } });
  else await prisma.tag.create({ data: { name, slug } });
  revalidatePath('/admin/tags');
  revalidateTag('reader-content');
}

export async function deleteTag(id: string) {
  await ensureStaff();
  await prisma.tag.delete({ where: { id } });
  revalidatePath('/admin/tags');
  revalidateTag('reader-content');
}

/* --------------------------------- Pages --------------------------------- */

export async function savePage(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  const content = sanitizeArticleHtml(((formData.get('content') as string) || '').trim());
  const status = (formData.get('status') as string) || 'DRAFT';
  if (!title || !content) throw new Error('Title and content required');
  const slug = await uniqueSlug(title, 'page', id || undefined);
  if (id) await prisma.page.update({ where: { id }, data: { title, slug, content, status } });
  else await prisma.page.create({ data: { title, slug, content, status } });
  revalidatePath('/admin/pages');
  revalidateTag('reader-content');
  redirect('/admin/pages');
}

export async function setPageStatus(id: string, status: string) {
  await ensureStaff();
  await prisma.page.update({ where: { id }, data: { status } });
  revalidatePath('/admin/pages');
  revalidateTag('reader-content');
}

export async function deletePage(id: string) {
  await ensureStaff();
  await prisma.page.delete({ where: { id } });
  revalidatePath('/admin/pages');
  revalidateTag('reader-content');
}

/* --------------------------------- Users --------------------------------- */

export async function createUser(formData: FormData) {
  await ensureAdmin();
  const name = ((formData.get('name') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';
  const role = (formData.get('role') as string) || 'USER';
  if (!name || !email || password.length < 6) throw new Error('Name, email and a 6+ char password are required');
  if (!ROLES.includes(role as any)) throw new Error('Invalid role');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already in use');
  await prisma.user.create({ data: { name, email, role, status: 'ACTIVE', passwordHash: await hashPassword(password) } });
  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function updateUser(formData: FormData) {
  const actor = await ensureAdmin();
  const id = (formData.get('id') as string) || '';
  const name = ((formData.get('name') as string) || '').trim();
  const role = (formData.get('role') as string) || 'USER';
  const status = (formData.get('status') as string) || 'ACTIVE';
  const accountType = (formData.get('accountType') as string) || 'MEMBER';
  const storeType = ((formData.get('storeType') as string) || '').trim();
  const region = ((formData.get('region') as string) || '').trim();
  const notes = ((formData.get('notes') as string) || '').trim();
  const newPassword = (formData.get('password') as string) || '';
  if (!id) throw new Error('Missing user');
  if (!ROLES.includes(role as any) || !USER_STATUSES.includes(status as any)) throw new Error('Invalid role/status');
  if (!ACCOUNT_TYPES.includes(accountType as any)) throw new Error('Invalid account type');
  if (actor.id === id && (role !== 'ADMIN' || status !== 'ACTIVE')) {
    throw new Error('You cannot remove your own admin access or deactivate yourself.');
  }
  const data: any = { name, role, status, accountType, storeType: storeType || null, region: region || null, notes: notes || null };
  if (newPassword) { if (newPassword.length < 6) throw new Error('Password too short'); data.passwordHash = await hashPassword(newPassword); }
  await prisma.user.update({ where: { id }, data });
  revalidatePath('/admin/users');
  redirect('/admin/users');
}

export async function setUserStatus(id: string, status: string) {
  const actor = await ensureAdmin();
  if (!USER_STATUSES.includes(status as any)) throw new Error('Invalid status');
  if (actor.id === id) throw new Error('You cannot change your own status.');
  await prisma.user.update({ where: { id }, data: { status } });
  revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
  const actor = await ensureAdmin();
  if (actor.id === id) throw new Error('You cannot delete yourself.');
  await prisma.user.delete({ where: { id } });
  revalidatePath('/admin/users');
}

/* --------------------------- Ad campaigns -------------------------------- */

export async function createAdCampaign(formData: FormData) {
  await ensureStaff();
  const vendorName = ((formData.get('vendorName') as string) || '').trim();
  const plan = ((formData.get('plan') as string) || '').trim();
  const startRaw = ((formData.get('startAt') as string) || '').trim();
  const endRaw = ((formData.get('endAt') as string) || '').trim();
  const notes = ((formData.get('notes') as string) || '').trim();
  if (!vendorName) throw new Error('Vendor name is required');
  const startAt = new Date(startRaw);
  if (isNaN(startAt.getTime())) throw new Error('A valid start date is required');
  const endAt = endRaw ? new Date(endRaw) : undefined;
  if (endAt && isNaN(endAt.getTime())) throw new Error('Invalid end date');
  const id = await createCampaign({ vendorName, plan, startAt, endAt: endAt ?? null, notes });
  revalidatePath('/admin/campaigns');
  redirect(`/admin/campaigns/${id}`);
}

export async function assignFlightAds(formData: FormData) {
  await ensureStaff();
  const flightId = (formData.get('flightId') as string) || '';
  const adIds = formData.getAll('adIds').map(String).filter(Boolean);
  if (flightId && adIds.length) await assignAdsToFlight(flightId, adIds);
  revalidatePath(`/admin/campaigns/${(formData.get('campaignId') as string) || ''}`);
}

export async function scheduleAdFlight(campaignId: string, flightId: string) {
  await ensureStaff();
  await scheduleFlight(flightId);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath('/docs');
}

export async function pauseAdFlight(campaignId: string, flightId: string) {
  await ensureStaff();
  await pauseFlight(flightId);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath('/docs');
}

export async function cancelAdCampaign(id: string) {
  await ensureStaff();
  await cancelCampaign(id);
  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath('/docs');
}

// Save an admin override for an email template's copy (subject + body). Falls
// back to the built-in default if the row is later reset/removed.
export async function saveEmailTemplate(formData: FormData) {
  await ensureAdmin(); // vendor-facing email copy — admins only, not editors
  const key = ((formData.get('key') as string) || '').trim();
  if (!EMAIL_TEMPLATES[key]) throw new Error('Unknown template');
  const subject = ((formData.get('subject') as string) || '').trim().slice(0, 300);
  const body = ((formData.get('body') as string) || '').trim().slice(0, 8000);
  if (!subject || !body) throw new Error('Subject and body are required');
  await prisma.emailTemplate.upsert({ where: { key }, update: { subject, body }, create: { key, subject, body } });
  revalidatePath('/admin/email-templates');
}

// Reset a template to its built-in default (drops the admin override).
export async function resetEmailTemplate(key: string) {
  await ensureAdmin(); // vendor-facing email copy — admins only, not editors
  await prisma.emailTemplate.deleteMany({ where: { key } });
  revalidatePath('/admin/email-templates');
}

// Set a vendor's reminder contact email + notes (fills a gap when JotForm didn't
// carry an email, so flight/renewal reminders can actually reach them).
export async function saveVendorContact(formData: FormData) {
  await ensureStaff();
  const id = ((formData.get('vendorId') as string) || '').trim();
  if (!id) throw new Error('vendorId required');
  await updateVendorContact(id, (formData.get('contactEmail') as string) || '', (formData.get('notes') as string) || '');
  revalidatePath('/admin/vendors');
}

// Admin: edit an advertiser's full reader-facing profile (name, premium flag,
// website, phone, contact email, blurb, logo, private notes).
export async function saveVendorProfile(formData: FormData) {
  await ensureStaff();
  const id = ((formData.get('id') as string) || '').trim();
  if (!id) throw new Error('id required');
  const s = (k: string, max: number) => { const v = ((formData.get(k) as string) || '').trim(); return v ? v.slice(0, max) : null; };
  const name = s('name', 120);
  const newPremium = formData.get('premium') === 'on';

  // Premium lifecycle: stamp the timestamps only on a real transition so the
  // "new arrival" and "leaving grace" windows are accurate.
  //  • gained premium → premiumSince=now, clear premiumEndedAt (and restore any
  //    saved entries soft-removed on a prior departure — notes come back).
  //  • lost premium   → premiumEndedAt=now (starts the phone-book grace).
  const current = await prisma.vendor.findUnique({ where: { id }, select: { premium: true } });
  const wasPremium = !!current?.premium;
  const lifecycle: { premiumSince?: Date; premiumEndedAt?: Date | null } = {};
  if (!wasPremium && newPremium) { lifecycle.premiumSince = new Date(); lifecycle.premiumEndedAt = null; }
  else if (wasPremium && !newPremium) { lifecycle.premiumEndedAt = new Date(); }

  await prisma.vendor.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      premium: newPremium,
      ...lifecycle,
      website: s('website', 300),
      supplierUrl: s('supplierUrl', 300),
      contactName: s('contactName', 120),
      phone: s('phone', 60),
      contactEmail: s('contactEmail', 200),
      blurb: s('blurb', 600),
      logoUrl: s('logoUrl', 1000),
      notes: s('notes', 2000),
    },
  });

  // Rejoin restore: bring back saved entries that were soft-removed while this
  // vendor was gone. No-op for a first-time premium or an unchanged save.
  if (!wasPremium && newPremium) await reactivateSavedSuppliers(id);

  revalidatePath('/admin/vendors');
  revalidatePath(`/admin/vendors/${id}`);
  revalidatePath('/docs/suppliers');
}

// ---- Reader phone book (account-tied) ----
export async function addSavedSupplier(vendorId: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in to save suppliers.');
  // Only premium suppliers are in the directory / phone book.
  const v = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { premium: true } });
  if (!v?.premium) throw new Error('That supplier is not available in the Phone Book.');
  await prisma.savedSupplier.upsert({
    where: { userId_vendorId: { userId: u.id, vendorId } },
    // Clear any prior soft-removal: the premium gate above means the supplier is
    // active, so re-starring must un-hide a lingering removedAt row (self-defensive
    // even if a future premium path forgot to reactivate).
    update: { removedAt: null },
    create: { userId: u.id, vendorId },
  });
  revalidatePath('/docs/suppliers');
  revalidatePath(`/docs/suppliers/${vendorId}`);
}
export async function removeSavedSupplier(vendorId: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  await prisma.savedSupplier.deleteMany({ where: { userId: u.id, vendorId } });
  revalidatePath('/docs/suppliers');
  revalidatePath(`/docs/suppliers/${vendorId}`);
}
// Save the reader's own note + optional alternative contact for a supplier.
// Upserts so it works whether or not the supplier is already starred.
export async function updateSavedSupplier(vendorId: string, data: { note?: string; altEmail?: string; altPhone?: string }) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  // Same premium gate as addSavedSupplier — the create branch here can otherwise
  // manufacture a saved-supplier row for a non-premium (or wrong) vendor.
  const v = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { premium: true } });
  if (!v?.premium) throw new Error('That supplier is not available in the Phone Book.');
  const note = (data.note ?? '').trim().slice(0, 2000) || null;
  const altEmail = (data.altEmail ?? '').trim().slice(0, 200) || null;
  const altPhone = (data.altPhone ?? '').trim().slice(0, 60) || null;
  await prisma.savedSupplier.upsert({
    where: { userId_vendorId: { userId: u.id, vendorId } },
    // removedAt:null — premium-gated above, so saving a note also un-hides a
    // lingering soft-removed row (mirrors addSavedSupplier).
    update: { note, altEmail, altPhone, removedAt: null },
    create: { userId: u.id, vendorId, note, altEmail, altPhone },
  });
  revalidatePath('/docs/suppliers');
  revalidatePath(`/docs/suppliers/${vendorId}`);
}

// ---- Supplier testimonials ----

// Admin: at spotlight time, open a testimonial request for a premium supplier.
// Nudges every reader who has them starred (and hasn't vouched yet) via the
// derived notifications feed. Only one request is active at a time.
export async function requestSupplierTestimonials(vendorId: string) {
  await ensureStaff();
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { premium: true } });
  if (!vendor) throw new Error('Vendor not found');
  if (!vendor.premium) throw new Error('Only premium suppliers can collect testimonials.');
  await prisma.$transaction([
    prisma.testimonialRequest.updateMany({ where: { vendorId, active: true }, data: { active: false } }),
    prisma.testimonialRequest.create({ data: { vendorId } }),
  ]);
  revalidatePath(`/admin/vendors/${vendorId}`);
}

// Reader: submit (or edit) a testimonial for a supplier they have in their phone
// book. Re-submitting replaces their own text and returns to PENDING review.
export async function submitTestimonial(formData: FormData) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in to leave a testimonial.');
  const vendorId = ((formData.get('vendorId') as string) || '').trim();
  const body = ((formData.get('body') as string) || '').trim().slice(0, 1500);
  if (!vendorId) throw new Error('Missing supplier');
  if (body.length < 10) throw new Error('Please write a little more.');
  // Gate to savers: a testimonial should come from someone who actually uses them.
  const saved = await prisma.savedSupplier.findUnique({
    where: { userId_vendorId: { userId: u.id, vendorId } }, select: { id: true },
  });
  if (!saved) throw new Error('Add this supplier to your Phone Book first.');
  // Snapshot the account-holder name + store name so the record is stable even if
  // their profile later changes.
  const prof = await prisma.user.findUnique({ where: { id: u.id }, select: { storeName: true, memberCode: true } });
  await prisma.testimonial.upsert({
    where: { userId_vendorId: { userId: u.id, vendorId } },
    // Editing returns to PENDING AND pulls it from the vendor document, so edited
    // text can't be silently re-published — the admin must re-approve + re-add it.
    update: { body, status: 'PENDING', showOnVendorDashboard: false, authorName: u.name, storeName: prof?.storeName ?? null, memberCode: prof?.memberCode ?? null },
    create: { userId: u.id, vendorId, body, authorName: u.name, storeName: prof?.storeName ?? null, memberCode: prof?.memberCode ?? null },
  });
  revalidatePath(`/docs/suppliers/${vendorId}`);
}

// Admin: approve / reject / reset a submitted testimonial.
export async function setTestimonialStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
  await ensureStaff();
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) throw new Error('Bad status');
  const t = await prisma.testimonial.update({
    where: { id },
    // Rejecting/un-approving also pulls it from the vendor's document.
    data: { status, ...(status === 'APPROVED' ? {} : { showOnVendorDashboard: false }) },
    select: { vendorId: true },
  });
  revalidatePath(`/admin/vendors/${t.vendorId}`);
  revalidatePath('/docs/vendor');
  revalidatePath('/vendor-testimonials');
}

// Admin: include / remove an APPROVED testimonial in the advertiser's vendor-
// dashboard document.
export async function setTestimonialOnDashboard(id: string, on: boolean) {
  await ensureStaff();
  const cur = await prisma.testimonial.findUnique({ where: { id }, select: { status: true, vendorId: true } });
  if (!cur) throw new Error('Not found');
  if (on && cur.status !== 'APPROVED') throw new Error('Approve the testimonial first.');
  await prisma.testimonial.update({ where: { id }, data: { showOnVendorDashboard: on } });
  revalidatePath(`/admin/vendors/${cur.vendorId}`);
  revalidatePath('/docs/vendor');
  revalidatePath('/vendor-testimonials');
}

// ---- Phone-book sticky notes (private, per reader + supplier) ----
export async function addSupplierNote(vendorId: string, body: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  const text = (body || '').trim().slice(0, 500);
  if (!text) throw new Error('Empty note');
  // Only for suppliers in the reader's phone book.
  const saved = await prisma.savedSupplier.findUnique({ where: { userId_vendorId: { userId: u.id, vendorId } }, select: { id: true } });
  if (!saved) throw new Error('Add this supplier to your Phone Book first.');
  await prisma.supplierNote.create({ data: { userId: u.id, vendorId, body: text } });
  revalidatePath(`/docs/suppliers/${vendorId}`);
}
export async function deleteSupplierNote(id: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  // deleteMany scoped to owner so a reader can only remove their own notes.
  const note = await prisma.supplierNote.findUnique({ where: { id }, select: { vendorId: true, userId: true } });
  if (!note || note.userId !== u.id) return;
  await prisma.supplierNote.deleteMany({ where: { id, userId: u.id } });
  revalidatePath(`/docs/suppliers/${note.vendorId}`);
}

// ---- Vendor "update your ads" link (admin-set; shown on the vendor dashboard) ----
export async function setAdUpdateUrl(formData: FormData) {
  await ensureStaff();
  const url = ((formData.get('url') as string) || '').trim().slice(0, 500);
  await prisma.setting.upsert({ where: { key: AD_UPDATE_URL_KEY }, update: { value: url }, create: { key: AD_UPDATE_URL_KEY, value: url } });
  revalidatePath('/admin/vendors');
  revalidatePath('/docs/vendor');
}

// ---- Vendor self-serve report requests ----
const REPORT_COOLDOWN_DAYS = 30;

// A vendor asks us to compile a performance report for a period. Rate-limited:
// one open request at a time, and one new request per 30 days.
export async function requestVendorReport(period: string) {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sign in.');
  if (!isVendor(entitlementsOf(u))) throw new Error('This is for advertisers.');
  // Coupled to the premium switch: a de-listed vendor can't queue reports either.
  if (!(await isActiveVendor(u))) throw new Error('The advertiser dashboard is available to active premium suppliers only.');
  if (!REPORT_PERIODS[period]) throw new Error('Pick a period.');
  const vendorId = await vendorIdForBrand(entitlementsOf(u).vendorBrand);
  if (!vendorId) throw new Error('No advertiser record is linked to your account.');

  const pending = await prisma.adReportRequest.findFirst({ where: { vendorId, status: 'PENDING' }, select: { id: true } });
  if (pending) throw new Error('You already have a report request in progress — we’ll send it soon.');
  const recent = await prisma.adReportRequest.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  if (recent) {
    const nextOk = recent.createdAt.getTime() + REPORT_COOLDOWN_DAYS * 864e5;
    if (Date.now() < nextOk) throw new Error(`You can request another report after ${new Date(nextOk).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`);
  }
  await prisma.adReportRequest.create({ data: { vendorId, userId: u.id, period } });
  revalidatePath('/docs/vendor');
}

// Admin: mark a report request fulfilled (after building + sending it).
export async function fulfillReportRequest(id: string) {
  await ensureStaff();
  const r = await prisma.adReportRequest.update({ where: { id }, data: { status: 'FULFILLED', fulfilledAt: new Date() }, select: { vendorId: true } });
  revalidatePath(`/admin/vendors/${r.vendorId}`);
  revalidatePath('/docs/vendor');
}

// Competitor groups: advertisers that must never run alongside each other, and
// whose rivals are suppressed in any article that names one of them.
export async function saveCompetitorGroup(formData: FormData) {
  await ensureStaff();
  const id = ((formData.get('id') as string) || '').trim();
  const name = ((formData.get('name') as string) || '').trim() || 'Competitor group';
  const brands = formData.getAll('brands').map((b) => String(b).trim()).filter(Boolean);
  if (brands.length < 2) throw new Error('A group needs at least two advertisers.');
  const data = { name, brands: brands.join(', ') };
  if (id) await prisma.competitorGroup.update({ where: { id }, data });
  else await prisma.competitorGroup.create({ data });
  revalidatePath('/admin/vendors');
  revalidatePath('/docs');
}

export async function deleteCompetitorGroup(formData: FormData) {
  await ensureStaff();
  const id = ((formData.get('id') as string) || '').trim();
  if (!id) throw new Error('id required');
  await prisma.competitorGroup.delete({ where: { id } });
  revalidatePath('/admin/vendors');
  revalidatePath('/docs');
}

// Confirm a campaign's payment landed (per JotForm) so its flights can be
// scheduled. No money moves through the hub — this is a confirmation flag only.
export async function markAdCampaignPaid(formData: FormData) {
  await ensureStaff();
  const id = ((formData.get('campaignId') as string) || '').trim();
  if (!id) throw new Error('campaignId required');
  const amountCents = parseAmountToCents((formData.get('amount') as string) || '');
  const note = ((formData.get('note') as string) || '').trim() || undefined;
  await markCampaignPaid(id, amountCents, note);
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath('/admin/campaigns');
}

/* --------------------- Vendor performance reports ------------------------ */

// Auto-draft a quarterly report for a vendor from the ad analytics. `period` is
// the quarter start (ISO date) chosen in the admin; the quarter is derived from
// it so start/end always align to real calendar quarters.
export async function generatePerformanceReport(formData: FormData) {
  await ensureStaff();
  const vendorId = ((formData.get('vendorId') as string) || '').trim();
  const periodStart = ((formData.get('periodStart') as string) || '').trim();
  if (!vendorId) throw new Error('A vendor is required');
  const d = new Date(periodStart);
  if (isNaN(d.getTime())) throw new Error('A valid quarter is required');
  const id = await generateReportDraft(vendorId, quarterOf(d));
  revalidatePath('/admin/reports');
  // Regenerating returns a PUBLISHED report to DRAFT, so it leaves the vendor
  // dashboard — refresh that surface too.
  revalidatePath('/docs/vendor');
  redirect(`/admin/reports/${id}`);
}

export async function savePerformanceReportSummary(id: string, formData: FormData) {
  await ensureStaff();
  await updateReportSummary(id, ((formData.get('summary') as string) || '').trim());
  revalidatePath(`/admin/reports/${id}`);
}

export async function publishPerformanceReport(id: string) {
  // Publishing pushes a report to the vendor — admin-only, above the EDITOR bar.
  await ensureAdmin();
  await publishReport(id);
  revalidatePath(`/admin/reports/${id}`);
  revalidatePath('/admin/reports');
  revalidatePath('/docs/vendor');
}

export async function unpublishPerformanceReport(id: string) {
  await ensureAdmin();
  await unpublishReport(id);
  revalidatePath(`/admin/reports/${id}`);
  revalidatePath('/admin/reports');
  revalidatePath('/docs/vendor');
}

/* ------------------------- Analytics maintenance ------------------------- */

// Manually rebuild the daily rollups (last 90 days) and apply the retention
// prune — the same work the nightly cron does, on an admin button. Idempotent.
export async function rebuildAnalyticsRollups() {
  await ensureStaff();
  await rollupDays(recentDayKeys(new Date(), 90));
  await pruneOldEvents(new Date());
  revalidatePath('/admin/analytics');
}

/* ---------------------------- Homepage layout ---------------------------- */

// All homepage arrangement edits below modify the DRAFT layout only; the public
// homepage is unchanged until an admin calls publishHomeLayout ("Go Live").
export async function moveHomeModule(id: string, direction: 'up' | 'down') {
  await ensureStaff();
  const layout = await getDraftLayout();
  const i = layout.findIndex((m) => m.id === id);
  if (i === -1 || layout[i].locked) return;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= layout.length || layout[j].locked) return;
  [layout[i], layout[j]] = [layout[j], layout[i]];
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

// Persist a drag-and-drop order (locks are enforced server-side).
export async function reorderHomeModules(orderedIds: string[]) {
  await ensureStaff();
  const layout = await getDraftLayout();
  await saveDraftLayout(applyReorder(layout, orderedIds));
  revalidatePath('/admin/homepage');
}

export async function toggleHomeModule(id: string) {
  await ensureStaff();
  const layout = await getDraftLayout();
  const m = layout.find((x) => x.id === id);
  if (!m || m.locked) return; // locked modules can't be hidden
  m.enabled = !m.enabled;
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

export async function toggleHomeLock(id: string) {
  await ensureStaff();
  const layout = await getDraftLayout();
  const m = layout.find((x) => x.id === id);
  if (!m) return;
  m.locked = !m.locked;
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

// Draft size-lock toggle (used by the layout editor). Freezes the ⅓/⅔/full
// width control for this module.
export async function toggleHomeSizeLock(id: string) {
  await ensureStaff();
  const layout = await getDraftLayout();
  const m = layout.find((x) => x.id === id);
  if (!m) return;
  m.sizeLocked = !m.sizeLocked;
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

// Live-immediate lock toggles, driven from the on-homepage admin toolbar. They
// publish straight to the live layout (and sync a pending draft) so the lock
// takes effect in place, unlike the draft-staged editor controls.
export async function toggleHomeLockLive(id: string) {
  await ensureStaff();
  // Compute the target from live ONCE, then apply that absolute value to both live
  // and the draft — so live and draft can't toggle independently and diverge.
  const live = await getHomeLayout();
  const next = !live.find((x) => x.id === id)?.locked;
  await patchModuleLive(id, (m) => { m.locked = next; });
  revalidatePath('/docs');
  revalidatePath('/admin/homepage');
}
export async function toggleHomeSizeLockLive(id: string) {
  await ensureStaff();
  const live = await getHomeLayout();
  const next = !live.find((x) => x.id === id)?.sizeLocked;
  await patchModuleLive(id, (m) => { m.sizeLocked = next; });
  revalidatePath('/docs');
  revalidatePath('/admin/homepage');
}

// On-homepage "Arrange" drop: persist the new visible-module order to live (and
// mirror any pending draft). Locked + hidden modules keep their slots.
export async function reorderHomeLive(orderedVisibleIds: string[]) {
  await ensureStaff();
  if (!Array.isArray(orderedVisibleIds)) return;
  await reorderLiveLayout(orderedVisibleIds.map(String));
  revalidatePath('/docs');
  revalidatePath('/admin/homepage');
}

// On-homepage "Arrange" eye toggle: show/hide a module live (mirrors draft).
export async function setHomeVisibilityLive(id: string, enabled: boolean) {
  await ensureStaff();
  await patchModuleLive(id, (m) => { m.enabled = enabled; });
  revalidatePath('/docs');
  revalidatePath('/admin/homepage');
}

export async function setHomeModuleSource(id: string, source: string) {
  await ensureStaff();
  const layout = await getDraftLayout();
  const m = layout.find((x) => x.id === id);
  const def = MODULE_CATALOG[id as ModuleId];
  if (!m || !def?.sources) return;
  if (!def.sources.some((s) => s.value === source)) return; // reject unknown source
  m.source = source;
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

// Set a module's homepage width (1 = one-third, 2 = two-thirds, 3 = full).
export async function setHomeModuleSpan(id: string, span: number) {
  await ensureStaff();
  const layout = await getDraftLayout();
  const m = layout.find((x) => x.id === id);
  if (!m) return;
  m.span = clampSpan(span);
  await saveDraftLayout(layout);
  revalidatePath('/admin/homepage');
}

// Auto-archive age (months) for published articles; 0 = off. Clears the sweep's
// throttle so a change takes effect on the next homepage load.
export async function setAutoArchiveMonths(formData: FormData) {
  await ensureStaff();
  const raw = Number(formData.get('months'));
  const months = Number.isFinite(raw) && raw > 0 ? Math.min(Math.round(raw), 1200) : 0;
  await prisma.setting.upsert({ where: { key: 'auto_archive_months' }, update: { value: String(months) }, create: { key: 'auto_archive_months', value: String(months) } });
  await prisma.setting.deleteMany({ where: { key: 'auto_archive_last_run' } });
  revalidatePath('/admin/articles');
  revalidatePath('/docs');
}

// Width for the two pinned top sections (Hero, "Published this week"), which
// live above the module grid rather than in the layout array. Only Full (3) or
// ⅔ (2) — never ⅓ — and a ⅔ section just leaves the remaining third open.
export async function setSectionSpan(key: string, span: number) {
  await ensureStaff();
  if (key !== 'home_hero_span' && key !== 'home_week_span') return; // whitelist
  const value = span === 2 ? '2' : '3';
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  revalidatePath('/docs');
}

export async function resetHomeLayout() {
  await ensureStaff();
  await saveDraftLayout(DEFAULT_LAYOUT);
  revalidatePath('/admin/homepage');
}

// Go Live: promote the draft arrangement to the public homepage.
export async function publishHomeLayout() {
  await ensureStaff();
  await publishDraftLayout();
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

// Throw away pending draft changes and snap back to what's currently live.
export async function discardHomeDraft() {
  await ensureStaff();
  await discardDraftLayout();
  revalidatePath('/admin/homepage');
}

// Persist the signed-in member's chosen UI theme so it follows them across
// devices. No-ops for anonymous visitors (they rely on localStorage). Accepts
// only the three known themes; anything else is ignored.
export async function setUserTheme(theme: string) {
  const user = await getSessionUser();
  if (!user) return; // anonymous — localStorage handles persistence
  if (theme !== 'light' && theme !== 'dark' && theme !== 'rs') return;
  await prisma.user.update({ where: { id: user.id }, data: { theme } });
}

/* --------------------------- Module Studio ------------------------------- */
// Custom homepage modules built in the Studio. Trees are always normalized on
// write (see lib/studio) so nothing unsafe is ever persisted.

export async function createCustomModule(name: string, shape: string): Promise<string> {
  await ensureStaff();
  const clean = (name || '').trim().slice(0, 80) || 'Untitled module';
  const s: Shape = isShape(shape) ? shape : 'column';
  const mod = await prisma.customModule.create({
    data: { name: clean, shape: s, tree: serializeTree(emptyTree(s)), published: false },
  });
  revalidatePath('/admin/studio');
  return mod.id;
}

export async function saveCustomModuleTree(id: string, treeJson: string): Promise<void> {
  await ensureStaff();
  const tree = parseTree(treeJson); // parse + normalize (never throws)
  await prisma.customModule.update({
    where: { id },
    data: { tree: serializeTree(tree), shape: tree.shape },
  });
  revalidatePath('/admin/studio');
  revalidatePath(`/admin/studio/${id}`);
  revalidatePath('/docs');
}

export async function renameCustomModule(id: string, name: string): Promise<void> {
  await ensureStaff();
  await prisma.customModule.update({ where: { id }, data: { name: (name || '').trim().slice(0, 80) || 'Untitled module' } });
  revalidatePath('/admin/studio');
}

export async function setCustomModulePublished(id: string, published: boolean): Promise<void> {
  await ensureStaff();
  await prisma.customModule.update({ where: { id }, data: { published: !!published } });
  // On publish, STAGE the module into the draft homepage (appended, enabled) if
  // it isn't placed yet — it won't appear publicly until the admin hits Go Live.
  // Unpublishing leaves its slot in place but gated off (published=false), so it
  // simply doesn't render live.
  if (published) {
    const mod = await prisma.customModule.findUnique({ where: { id }, select: { tree: true } });
    let defaultSpan = 3;
    if (mod) {
      const tree = parseTree(mod.tree);
      defaultSpan = clampSpan(tree.defaultSpan);
      // Materialize any inline poll blocks (legacy) into real Poll records.
      const changed = await materializeModulePolls(tree);
      if (changed) await prisma.customModule.update({ where: { id }, data: { tree: serializeTree(tree) } });
      // Anchor the invisible expiry timer (if any) from now.
      const expiresAt = tree.expireDays && tree.expireDays > 0 ? new Date(Date.now() + tree.expireDays * 86400000) : null;
      await prisma.customModule.update({ where: { id }, data: { expiresAt } });
    }
    const layoutId = `custom:${id}`;
    const layout = await getDraftLayout();
    if (!layout.some((m) => m.id === layoutId)) {
      // Seed the placement's width from the module's chosen default width so a
      // module built as "⅓" lands as ⅓ (the admin can still re-size it per slot).
      await saveDraftLayout([...layout, { id: layoutId, enabled: true, locked: false, span: defaultSpan }]);
    }
  } else {
    await prisma.customModule.update({ where: { id }, data: { expiresAt: null } });
  }
  revalidatePath('/admin/studio');
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

export async function deleteCustomModule(id: string): Promise<void> {
  await ensureStaff();
  await prisma.customModule.delete({ where: { id } });
  // Drop it from BOTH the live and draft layouts so no dangling reference remains.
  const layoutId = `custom:${id}`;
  const [live, draft] = await Promise.all([getHomeLayout(), getDraftLayout()]);
  const prunedLive = live.filter((m) => m.id !== layoutId);
  if (prunedLive.length !== live.length) await saveHomeLayout(prunedLive);
  const prunedDraft = draft.filter((m) => m.id !== layoutId);
  if (prunedDraft.length !== draft.length) await saveDraftLayout(prunedDraft);
  revalidatePath('/admin/studio');
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

/* --------------------------- Appearance ---------------------------------- */

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RS_BG_KEY = 'rs_bg_color';

// Admin-set RS-Mode page background. Empty string clears it (back to the default
// textured surround). Only affects RS Mode; Light/Dark are unchanged.
export async function setRsBackground(color: string): Promise<void> {
  await ensureStaff();
  const raw = (color || '').trim();
  if (raw && !HEX_RE.test(raw)) throw new Error('Invalid color');
  if (!raw) await prisma.setting.deleteMany({ where: { key: RS_BG_KEY } });
  else await prisma.setting.upsert({ where: { key: RS_BG_KEY }, update: { value: raw }, create: { key: RS_BG_KEY, value: raw } });
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

/* ------------------- Quick post to homepage (poll/quiz) ------------------ */
// One-click: wrap a poll or quiz in its own single-element custom module,
// publish it, and stage it on the homepage — no trip to the Module Studio.
export async function addElementToHomepage(kind: 'poll' | 'quiz', refId: string, name: string, shape: string, rsColor: string | null): Promise<void> {
  await ensureStaff();
  if (!refId) throw new Error('Missing id');
  const s: Shape = isShape(shape) ? shape : 'card';
  const child = kind === 'poll'
    ? { id: 'b0', type: 'poll', settings: { pollId: refId, chart: 'bar' } }
    : { id: 'b0', type: 'quiz', settings: { quizId: refId, timerHours: 0 } };
  const tree = parseTree(JSON.stringify({ shape: s, rsColor, children: [child] }));
  const mod = await prisma.customModule.create({
    data: { name: (name || (kind === 'poll' ? 'Poll' : 'Quiz')).slice(0, 80), shape: tree.shape, tree: serializeTree(tree), published: true },
  });
  const layout = await getDraftLayout();
  await saveDraftLayout([...layout, { id: `custom:${mod.id}`, enabled: true, locked: false }]);
  revalidatePath('/admin/homepage');
  revalidatePath('/admin/studio');
  revalidatePath('/admin/polls');
  revalidatePath('/admin/quizzes');
}

export type PlugSlot = { moduleId: string; moduleName: string; blockId: string; filled: boolean };

/** Find published modules that already have a poll/quiz element — spots this new
 *  poll/quiz could be pinned into. One slot per module (the first top-level one);
 *  `filled` flags a slot that already points at something (pinning replaces it). */
export async function findPollQuizSlots(kind: 'poll' | 'quiz'): Promise<PlugSlot[]> {
  await ensureStaff();
  const mods = await prisma.customModule.findMany({ where: { published: true }, select: { id: true, name: true, tree: true }, orderBy: { updatedAt: 'desc' } });
  const slots: PlugSlot[] = [];
  for (const m of mods) {
    const block = parseTree(m.tree).children.find((b) => b.type === kind);
    if (block) {
      const filled = kind === 'poll' ? !!block.settings.pollId : !!block.settings.quizId;
      slots.push({ moduleId: m.id, moduleName: m.name, blockId: block.id, filled });
    }
  }
  return slots;
}

/** Pin a specific poll/quiz into an existing element (writes its id into that
 *  block's settings). The module keeps everything else — this only fills the slot. */
export async function pinToSlot(kind: 'poll' | 'quiz', refId: string, moduleId: string, blockId: string): Promise<void> {
  await ensureStaff();
  if (!refId) throw new Error('Missing id');
  const mod = await prisma.customModule.findUnique({ where: { id: moduleId }, select: { tree: true } });
  if (!mod) throw new Error('Module not found');
  const tree = parseTree(mod.tree);
  const block = tree.children.find((b) => b.id === blockId && b.type === kind);
  if (!block) throw new Error('That slot no longer exists');
  block.settings = kind === 'poll'
    ? { ...block.settings, pollId: refId }
    : { ...block.settings, quizId: refId };
  await prisma.customModule.update({ where: { id: moduleId }, data: { tree: serializeTree(tree) } });
  revalidatePath('/admin/studio');
  revalidatePath(`/admin/studio/${moduleId}`);
  revalidatePath('/docs');
}
