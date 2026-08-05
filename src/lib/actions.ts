'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from './db';
import { requireAdmin, hashPassword, getCurrentUser } from './auth';
import { slugify, estimateReadMinutes, makeExcerpt } from './utils';
import { CONTENT_STATUSES, USER_STATUSES, ROLES, ACCOUNT_TYPES } from './constants';
import { getHomeLayout, saveHomeLayout, applyReorder, DEFAULT_LAYOUT, MODULE_CATALOG, type ModuleId } from './homepage';
import { parseQuizBlocks, resolveClosesAt } from './quiz';
import { rollupDays, recentDayKeys, pruneOldEvents } from './analytics/rollup';
import { sanitizeArticleHtml } from './sanitize';
import { createCampaign, assignAdsToFlight, scheduleFlight, pauseFlight, cancelCampaign } from './campaigns';
import { generateReportDraft, updateReportSummary, publishReport, unpublishReport, quarterOf } from './reports';

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

  if (id) {
    const existing = await prisma.article.findUnique({ where: { id }, select: { publishedAt: true, status: true, title: true } });
    if (!existing) throw new Error('Article not found');
    const slug = await uniqueSlug(title, 'article', id);
    await prisma.article.update({
      where: { id },
      data: {
        title, slug, content, excerpt, coverImage: coverImage || null, status, requirement, featured, pinned, readMinutes,
        categoryId: categoryId || null,
        // Explicit date wins (backdate or schedule); otherwise keep existing or stamp now on publish.
        publishedAt: hasPubDate ? publishedAtInput : (nowPublished ? existing.publishedAt ?? new Date() : existing.publishedAt),
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  } else {
    const slug = await uniqueSlug(title, 'article');
    await prisma.article.create({
      data: {
        title, slug, content, excerpt, coverImage: coverImage || null, status, requirement, featured, pinned, readMinutes,
        categoryId: categoryId || null, authorId: staff.id,
        publishedAt: hasPubDate ? publishedAtInput : (nowPublished ? new Date() : null),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  }

  revalidatePath('/admin/articles');
  revalidatePath('/docs');
  redirect('/admin/articles');
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
}

export async function deleteCategory(id: string) {
  await ensureStaff();
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
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
  if (!brand || !headline) throw new Error('Brand and headline are required');
  const data = { brand, headline, label: label || null, cta, href, accent, keywords, competitors, imageWide: imageWide || null, imageRect: imageRect || null, video: video || null, videoPoster: videoPoster || null, active };
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
  const order = parseInt((formData.get('order') as string) || '0', 10) || 0;
  const active = formData.get('active') != null;
  const postedRaw = ((formData.get('postedAt') as string) || '').trim();
  if (!title || !url) throw new Error('Title and URL are required');
  const data: { title: string; url: string; source: string | null; order: number; active: boolean; postedAt?: Date } =
    { title, url, source: source || null, order, active };
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

export async function createPoll(formData: FormData) {
  await ensureStaff();
  const question = ((formData.get('question') as string) || '').trim();
  const optionsRaw = ((formData.get('options') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const options = optionsRaw.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (!question || options.length < 2) throw new Error('A question and at least 2 options are required');
  const closes = closesRaw ? new Date(closesRaw) : null;
  // Only one poll active at a time — deactivate the others when publishing a new one.
  if (active) await prisma.poll.updateMany({ where: { active: true }, data: { active: false } });
  await prisma.poll.create({
    data: { question, active, closesAt: closes && !isNaN(closes.getTime()) ? closes : null,
      options: { create: options.map((label, i) => ({ label, order: i })) } },
  });
  revalidatePath('/admin/polls');
  revalidatePath('/docs');
}

export async function updatePoll(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const question = ((formData.get('question') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const closes = closesRaw ? new Date(closesRaw) : null;
  if (!question) throw new Error('Question is required');
  if (active) await prisma.poll.updateMany({ where: { active: true, id: { not: id } }, data: { active: false } });
  await prisma.poll.update({ where: { id }, data: { question, active, closesAt: closes && !isNaN(closes.getTime()) ? closes : null } });
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

export async function createQuiz(formData: FormData) {
  await ensureStaff();
  const title = ((formData.get('title') as string) || '').trim();
  const body = ((formData.get('questions') as string) || '').trim();
  const active = formData.get('active') != null;
  const hoursRaw = ((formData.get('hours') as string) || '').trim();
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  const questions = parseQuizBlocks(body);
  if (!title || questions.length < 1) throw new Error('A title and at least one question (each with 2+ options) are required');

  // Timer: an explicit close time wins; otherwise now + N hours (default 48).
  const closesAt = resolveClosesAt({ explicit: closesRaw ? new Date(closesRaw) : null, hours: hoursRaw ? Number(hoursRaw) : null });

  if (active) await prisma.quiz.updateMany({ where: { active: true }, data: { active: false } });
  await prisma.quiz.create({
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
}

export async function updateQuiz(formData: FormData) {
  await ensureStaff();
  const id = (formData.get('id') as string) || '';
  const title = ((formData.get('title') as string) || '').trim();
  const active = formData.get('active') != null;
  const closesRaw = ((formData.get('closesAt') as string) || '').trim();
  if (!title) throw new Error('Title is required');
  const closes = closesRaw ? new Date(closesRaw) : null;
  if (active) await prisma.quiz.updateMany({ where: { active: true, id: { not: id } }, data: { active: false } });
  await prisma.quiz.update({
    where: { id },
    data: { title, active, ...(closes && !isNaN(closes.getTime()) ? { closesAt: closes } : {}) },
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

export async function moveHomeModule(id: string, direction: 'up' | 'down') {
  await ensureStaff();
  const layout = await getHomeLayout();
  const i = layout.findIndex((m) => m.id === id);
  if (i === -1 || layout[i].locked) return;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= layout.length || layout[j].locked) return;
  [layout[i], layout[j]] = [layout[j], layout[i]];
  await saveHomeLayout(layout);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

// Persist a drag-and-drop order (locks are enforced server-side).
export async function reorderHomeModules(orderedIds: string[]) {
  await ensureStaff();
  const layout = await getHomeLayout();
  await saveHomeLayout(applyReorder(layout, orderedIds));
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

export async function toggleHomeModule(id: string) {
  await ensureStaff();
  const layout = await getHomeLayout();
  const m = layout.find((x) => x.id === id);
  if (!m || m.locked) return; // locked modules can't be hidden
  m.enabled = !m.enabled;
  await saveHomeLayout(layout);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

export async function toggleHomeLock(id: string) {
  await ensureStaff();
  const layout = await getHomeLayout();
  const m = layout.find((x) => x.id === id);
  if (!m) return;
  m.locked = !m.locked;
  await saveHomeLayout(layout);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

export async function setHomeModuleSource(id: string, source: string) {
  await ensureStaff();
  const layout = await getHomeLayout();
  const m = layout.find((x) => x.id === id);
  const def = MODULE_CATALOG[id as ModuleId];
  if (!m || !def?.sources) return;
  if (!def.sources.some((s) => s.value === source)) return; // reject unknown source
  m.source = source;
  await saveHomeLayout(layout);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}

export async function resetHomeLayout() {
  await ensureStaff();
  await saveHomeLayout(DEFAULT_LAYOUT);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}
