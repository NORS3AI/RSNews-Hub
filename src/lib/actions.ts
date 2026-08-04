'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from './db';
import { requireAdmin, hashPassword, getCurrentUser } from './auth';
import { slugify, estimateReadMinutes, makeExcerpt } from './utils';
import { CONTENT_STATUSES, USER_STATUSES, ROLES } from './constants';
import { getHomeLayout, saveHomeLayout, applyReorder, DEFAULT_LAYOUT } from './homepage';

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
  const content = ((formData.get('content') as string) || '').trim();
  const status = (formData.get('status') as string) || 'DRAFT';
  const categoryId = (formData.get('categoryId') as string) || '';
  const coverImage = ((formData.get('coverImage') as string) || '').trim();
  const featured = formData.get('featured') === 'on';
  const pinned = formData.get('pinned') === 'on';
  const excerptInput = ((formData.get('excerpt') as string) || '').trim();
  const tagsRaw = ((formData.get('tags') as string) || '').trim();

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
        title, slug, content, excerpt, coverImage: coverImage || null, status, featured, pinned, readMinutes,
        categoryId: categoryId || null,
        publishedAt: nowPublished ? existing.publishedAt ?? new Date() : existing.publishedAt,
        tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  } else {
    const slug = await uniqueSlug(title, 'article');
    await prisma.article.create({
      data: {
        title, slug, content, excerpt, coverImage: coverImage || null, status, featured, pinned, readMinutes,
        categoryId: categoryId || null, authorId: staff.id,
        publishedAt: nowPublished ? new Date() : null,
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
  const active = formData.get('active') != null;
  if (!brand || !headline) throw new Error('Brand and headline are required');
  const data = { brand, headline, label: label || null, cta, href, accent, keywords, competitors, active };
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
  const content = ((formData.get('content') as string) || '').trim();
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
  const notes = ((formData.get('notes') as string) || '').trim();
  const newPassword = (formData.get('password') as string) || '';
  if (!id) throw new Error('Missing user');
  if (!ROLES.includes(role as any) || !USER_STATUSES.includes(status as any)) throw new Error('Invalid role/status');
  if (actor.id === id && (role !== 'ADMIN' || status !== 'ACTIVE')) {
    throw new Error('You cannot remove your own admin access or deactivate yourself.');
  }
  const data: any = { name, role, status, notes: notes || null };
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

export async function resetHomeLayout() {
  await ensureStaff();
  await saveHomeLayout(DEFAULT_LAYOUT);
  revalidatePath('/admin/homepage');
  revalidatePath('/docs');
}
