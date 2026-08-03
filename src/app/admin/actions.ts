'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff, requireAdmin } from '@/lib/guards';
import {
  createArticle,
  updateArticle,
  setArticleStatus,
  deleteArticle,
  createCategory,
  deleteCategory,
} from '@/lib/articles';
import { createPage, updatePage, setPageStatus, deletePage } from '@/lib/pages';
import {
  createUser,
  updateUser,
  setUserStatus,
  deleteUser,
  emailExists,
} from '@/lib/users';
import type { ArticleStatus, PageStatus, Role, UserStatus } from '@/lib/types';

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}
function optInt(form: FormData, key: string): number | null {
  const v = str(form, key);
  return v ? Number(v) : null;
}

// ---- Articles ------------------------------------------------------------

export async function createArticleAction(formData: FormData) {
  const user = await requireStaff();
  const id = createArticle({
    title: str(formData, 'title') || 'Untitled',
    excerpt: str(formData, 'excerpt'),
    body: str(formData, 'body'),
    cover_image: str(formData, 'cover_image'),
    category_id: optInt(formData, 'category_id'),
    author_id: user.id,
    status: (str(formData, 'status') as ArticleStatus) || 'draft',
    tagNames: str(formData, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  });
  revalidatePath('/admin/articles');
  revalidatePath('/main');
  redirect(`/admin/articles/${id}/edit?saved=1`);
}

export async function updateArticleAction(formData: FormData) {
  await requireStaff();
  const id = Number(str(formData, 'id'));
  updateArticle(id, {
    title: str(formData, 'title'),
    excerpt: str(formData, 'excerpt'),
    body: str(formData, 'body'),
    cover_image: str(formData, 'cover_image'),
    category_id: optInt(formData, 'category_id'),
    status: (str(formData, 'status') as ArticleStatus) || 'draft',
    tagNames: str(formData, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  });
  revalidatePath('/admin/articles');
  revalidatePath(`/admin/articles/${id}/edit`);
  revalidatePath('/main');
  redirect(`/admin/articles/${id}/edit?saved=1`);
}

export async function setArticleStatusAction(formData: FormData) {
  await requireStaff();
  const id = Number(str(formData, 'id'));
  setArticleStatus(id, str(formData, 'status') as ArticleStatus);
  revalidatePath('/admin/articles');
  revalidatePath('/main');
}

export async function deleteArticleAction(formData: FormData) {
  await requireStaff();
  deleteArticle(Number(str(formData, 'id')));
  revalidatePath('/admin/articles');
  revalidatePath('/main');
}

// ---- Categories ----------------------------------------------------------

export async function createCategoryAction(formData: FormData) {
  await requireStaff();
  const name = str(formData, 'name');
  if (name) createCategory(name, str(formData, 'description'));
  revalidatePath('/admin/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  await requireStaff();
  deleteCategory(Number(str(formData, 'id')));
  revalidatePath('/admin/categories');
}

// ---- Pages ---------------------------------------------------------------

export async function createPageAction(formData: FormData) {
  await requireStaff();
  const id = createPage({
    title: str(formData, 'title') || 'Untitled page',
    body: str(formData, 'body'),
    status: (str(formData, 'status') as PageStatus) || 'draft',
  });
  revalidatePath('/admin/pages');
  redirect(`/admin/pages/${id}/edit?saved=1`);
}

export async function updatePageAction(formData: FormData) {
  await requireStaff();
  const id = Number(str(formData, 'id'));
  updatePage(id, {
    title: str(formData, 'title'),
    body: str(formData, 'body'),
    status: (str(formData, 'status') as PageStatus) || 'draft',
  });
  revalidatePath('/admin/pages');
  revalidatePath(`/admin/pages/${id}/edit`);
  redirect(`/admin/pages/${id}/edit?saved=1`);
}

export async function setPageStatusAction(formData: FormData) {
  await requireStaff();
  setPageStatus(Number(str(formData, 'id')), str(formData, 'status') as PageStatus);
  revalidatePath('/admin/pages');
}

export async function deletePageAction(formData: FormData) {
  await requireStaff();
  deletePage(Number(str(formData, 'id')));
  revalidatePath('/admin/pages');
}

// ---- Users (CRM) — admin only -------------------------------------------

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const email = str(formData, 'email').toLowerCase();
  if (!email || emailExists(email)) {
    redirect('/admin/users?error=' + encodeURIComponent('Email is required and must be unique.'));
  }
  createUser({
    name: str(formData, 'name') || email,
    email,
    password: str(formData, 'password') || 'changeme123',
    role: (str(formData, 'role') as Role) || 'user',
    status: (str(formData, 'status') as UserStatus) || 'active',
  });
  revalidatePath('/admin/users');
  redirect('/admin/users?saved=1');
}

export async function updateUserAction(formData: FormData) {
  await requireAdmin();
  const id = Number(str(formData, 'id'));
  const password = str(formData, 'password');
  updateUser(id, {
    name: str(formData, 'name'),
    email: str(formData, 'email').toLowerCase(),
    role: str(formData, 'role') as Role,
    status: str(formData, 'status') as UserStatus,
    ...(password ? { password } : {}),
  });
  revalidatePath('/admin/users');
  redirect('/admin/users?saved=1');
}

export async function setUserStatusAction(formData: FormData) {
  await requireAdmin();
  setUserStatus(Number(str(formData, 'id')), str(formData, 'status') as UserStatus);
  revalidatePath('/admin/users');
}

export async function setUserRoleAction(formData: FormData) {
  await requireAdmin();
  updateUser(Number(str(formData, 'id')), { role: str(formData, 'role') as Role });
  revalidatePath('/admin/users');
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(str(formData, 'id'));
  if (id === admin.id) {
    redirect('/admin/users?error=' + encodeURIComponent('You cannot delete your own account.'));
  }
  deleteUser(id);
  revalidatePath('/admin/users');
}
