import { getDb } from './db';
import { uniqueSlug } from './slug';
import type { Page, PageStatus } from './types';

const db = () => getDb();

export function listPages(status?: PageStatus | PageStatus[]): Page[] {
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    return db()
      .prepare(
        `SELECT * FROM pages WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY title`
      )
      .all(...statuses) as Page[];
  }
  return db().prepare('SELECT * FROM pages ORDER BY title').all() as Page[];
}

export function getPageBySlug(slug: string): Page | null {
  return (db().prepare('SELECT * FROM pages WHERE slug = ?').get(slug) as Page) || null;
}

export function getPageById(id: number): Page | null {
  return (db().prepare('SELECT * FROM pages WHERE id = ?').get(id) as Page) || null;
}

export interface PageInput {
  title: string;
  body?: string;
  status?: PageStatus;
  slug?: string;
}

export function createPage(input: PageInput): number {
  const slug =
    input.slug?.trim() ||
    uniqueSlug(input.title, (s) => !!db().prepare('SELECT 1 FROM pages WHERE slug = ?').get(s));
  const info = db()
    .prepare('INSERT INTO pages (title, slug, body, status) VALUES (?, ?, ?, ?)')
    .run(input.title, slug, input.body || '', input.status || 'draft');
  return Number(info.lastInsertRowid);
}

export function updatePage(id: number, input: PageInput): void {
  const existing = getPageById(id);
  if (!existing) throw new Error('Page not found');
  db()
    .prepare(
      `UPDATE pages SET title = ?, body = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(input.title ?? existing.title, input.body ?? existing.body, input.status ?? existing.status, id);
}

export function setPageStatus(id: number, status: PageStatus): void {
  db().prepare(`UPDATE pages SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
}

export function deletePage(id: number): void {
  db().prepare('DELETE FROM pages WHERE id = ?').run(id);
}
