'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { reconcileArticleAudio, generateArticleAudio } from './articleAudio';
import { requireAdmin, hashPassword, getCurrentUser, getSessionUser } from './auth';
import { slugify, estimateReadMinutes, makeExcerpt } from './utils';
import { CONTENT_STATUSES, USER_STATUSES, ROLES, ACCOUNT_TYPES } from './constants';
import { getHomeLayout, saveHomeLayout, getDraftLayout, saveDraftLayout, publishDraftLayout, discardDraftLayout, applyReorder, DEFAULT_LAYOUT, MODULE_CATALOG, type ModuleId } from './homepage';
import { parseQuizBlocks, resolveClosesAt } from './quiz';
import { rollupDays, recentDayKeys, pruneOldEvents } from './analytics/rollup';
import { sanitizeArticleHtml } from './sanitize';
import { createCampaign, assignAdsToFlight, scheduleFlight, pauseFlight, cancelCampaign } from './campaigns';
import { generateReportDraft, updateReportSummary, publishReport, unpublishReport, quarterOf } from './reports';
import { markCampaignPaid, parseAmountToCents } from './payments';
import { updateVendorContact } from './vendors';
import { EMAIL_TEMPLATES } from './emailTemplates';
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
  const featured = formData.get('featured') === 'on';
  const pinned = formData.get('pinned') === 'on';
  // Access gate token; normalize 'public' → '' (open) and lowercase for matching.
  const requirementRaw = ((formData.get('requirement') as string) || '').trim().toLowerCase();
  const requirement = requirementRaw === 'public' ? '' : requirementRaw;
  const excerptInput = ((formData.get('excerpt') as string) || '').trim();
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

  let savedId = id;
  if (id) {
    const existing = await prisma.article.findUnique({ where: { id }, select: { publishedAt: true, status: true, title: true, content: true, excerpt: true, authorId: true } });
    if (!existing) throw new Error('Article not found');
    // Snapshot the prior version before overwriting — only when the body actually
    // changed — so an editor can roll back. Capped per article.
    if (existing.content !== content) {
      await prisma.articleRevision.create({ data: { articleId: id, title: existing.title, content: existing.content, excerpt: existing.excerpt, authorId: existing.authorId } });
      const extra = await prisma.articleRevision.findMany({ where: { articleId: id }, orderBy: { createdAt: 'desc' }, skip: ARTICLE_REVISION_MAX, select: { id: true } });
      if (extra.length) await prisma.articleRevision.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    }
    const slug = await uniqueSlug(title, 'article', id);
    await prisma.article.update({
      where: { id },
      data: {
        title, slug, content, excerpt, coverImage: coverImage || null, status, requirement, featured, pinned, readMinutes,
        categoryId: categoryId || null,
        extraCategories: { set: extraCategoryIds.map((cid) => ({ id: cid })) },
        breakingUntil, // undefined leaves it unchanged (Prisma ignores undefined)
        // Explicit date wins (backdate or schedule); otherwise keep existing or stamp now on publish.
        publishedAt: hasPubDate ? publishedAtInput : (nowPublished ? existing.publishedAt ?? new Date() : existing.publishedAt),
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  } else {
    const slug = await uniqueSlug(title, 'article');
    const created = await prisma.article.create({
      data: {
        title, slug, content, excerpt, coverImage: coverImage || null, status, requirement, featured, pinned, readMinutes,
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

  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  redirect('/admin/articles');
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
    await prisma.article.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(content ? { content, excerpt: excerptInput || makeExcerpt(content), readMinutes: estimateReadMinutes(content) } : {}),
        coverImage: coverImage || null,
      },
    });
    return { ok: true, at: Date.now() };
  } catch {
    return { ok: false, at: now };
  }
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
  revalidatePath('/admin/articles');
  revalidatePath('/docs');
}

export async function deleteArticle(id: string) {
  await ensureStaff();
  await prisma.article.delete({ where: { id } });
  revalidatePath('/admin/articles');
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
}

export async function deleteCategory(id: string) {
  await ensureStaff();
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
  revalidatePath('/docs/categories');
  revalidatePath('/docs');
}

/* ----------------------------- Ad management ----------------------------- */

export async function saveAd(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const brand = ((formData.get('brand') as string) || '').trim();
  const headline = ((formData.get('headline') as string) || '').trim();
  const label = ((formData.get('label') as string) || '').trim();
  const cta = ((formData.get('cta') as string) || '').trim() || 'Learn more';
  const href = ((formData.get('href') as string) || '').trim() || '#';
  const accent = ((formData.get('accent') as string) || '').trim() || '#E97D34';
  const keywords = ((formData.get('keywords') as string) || '').trim();
  const competitors = ((formData.get('competitors') as string) || '').trim();
  const imageWide = ((formData.get('imageWide') as string) || '').trim();
  const imageRect = ((formData.get('imageRect') as string) || '').trim();
  const video = ((formData.get('video') as string) || '').trim();
  const videoPoster = ((formData.get('videoPoster') as string) || '').trim();
  const active = formData.get('active') != null;
  const parseDate = (v: string) => { const s = (v || '').trim(); if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const liveFrom = parseDate(formData.get('liveFrom') as string);
  const liveUntil = parseDate(formData.get('liveUntil') as string);
  if (!brand || !headline) throw new Error('Brand and headline are required');
  const data = { brand, headline, label: label || null, cta, href, accent, keywords, competitors, imageWide: imageWide || null, imageRect: imageRect || null, video: video || null, videoPoster: videoPoster || null, active, liveFrom, liveUntil };
  if (id) await prisma.ad.update({ where: { id }, data });
  else await prisma.ad.create({ data });
  revalidatePath('/admin/ads');
  revalidatePath('/docs');
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
  const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id));

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.poll.update({ where: { id }, data: { question, active, closesAt: closes && !isNaN(closes.getTime()) ? closes : null } }),
  ];
  rows.forEach((r, i) => {
    if (r.id) ops.push(prisma.pollOption.update({ where: { id: r.id }, data: { label: r.label.slice(0, 200), order: i } }));
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

  if (active) await prisma.quiz.updateMany({ where: { active: true }, data: { active: false } });
  const quiz = await prisma.quiz.create({
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

  if (active) await prisma.quiz.updateMany({ where: { active: true, id: { not: id } }, data: { active: false } });

  const existing = await prisma.quizQuestion.findMany({
    where: { quizId: id },
    include: { options: { select: { id: true, count: true } } },
  });
  const keptQ = new Set(questions.filter((q) => q.id).map((q) => q.id));

  await prisma.$transaction(async (tx) => {
    await tx.quiz.update({ where: { id }, data: { title, active, ...(closes && !isNaN(closes.getTime()) ? { closesAt: closes } : {}) } });

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      if (q.id) {
        await tx.quizQuestion.update({ where: { id: q.id }, data: { prompt: q.prompt.slice(0, 300), order: qi } });
        const existQ = existing.find((e) => e.id === q.id);
        const keptO = new Set(q.options.filter((o) => o.id).map((o) => o.id));
        for (let oi = 0; oi < q.options.length; oi++) {
          const o = q.options[oi];
          if (o.id) await tx.quizOption.update({ where: { id: o.id }, data: { label: o.label.slice(0, 200), correct: o.correct, order: oi } });
          else await tx.quizOption.create({ data: { questionId: q.id, label: o.label.slice(0, 200), correct: o.correct, order: oi } });
        }
        for (const eo of existQ?.options ?? []) {
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
}

export async function deleteTag(id: string) {
  await ensureStaff();
  await prisma.tag.delete({ where: { id } });
  revalidatePath('/admin/tags');
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
  redirect('/admin/pages');
}

export async function setPageStatus(id: string, status: string) {
  await ensureStaff();
  await prisma.page.update({ where: { id }, data: { status } });
  revalidatePath('/admin/pages');
}

export async function deletePage(id: string) {
  await ensureStaff();
  await prisma.page.delete({ where: { id } });
  revalidatePath('/admin/pages');
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
  await ensureStaff();
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
  await ensureStaff();
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
    if (mod) {
      const tree = parseTree(mod.tree);
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
      await saveDraftLayout([...layout, { id: layoutId, enabled: true, locked: false }]);
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
