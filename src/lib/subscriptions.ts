import { getDb } from './db';
import type { ArticleWithMeta, Category } from './types';

const db = () => getDb();

export function subscribeToArticle(userId: number, articleId: number): void {
  db()
    .prepare('INSERT OR IGNORE INTO subscriptions (user_id, article_id) VALUES (?, ?)')
    .run(userId, articleId);
}

export function unsubscribeFromArticle(userId: number, articleId: number): void {
  db()
    .prepare('DELETE FROM subscriptions WHERE user_id = ? AND article_id = ?')
    .run(userId, articleId);
}

export function isSubscribedToArticle(userId: number, articleId: number): boolean {
  return !!db()
    .prepare('SELECT 1 FROM subscriptions WHERE user_id = ? AND article_id = ?')
    .get(userId, articleId);
}

export function subscribeToCategory(userId: number, categoryId: number): void {
  db()
    .prepare('INSERT OR IGNORE INTO subscriptions (user_id, category_id) VALUES (?, ?)')
    .run(userId, categoryId);
}

export function unsubscribeFromCategory(userId: number, categoryId: number): void {
  db()
    .prepare('DELETE FROM subscriptions WHERE user_id = ? AND category_id = ?')
    .run(userId, categoryId);
}

export function isSubscribedToCategory(userId: number, categoryId: number): boolean {
  return !!db()
    .prepare('SELECT 1 FROM subscriptions WHERE user_id = ? AND category_id = ?')
    .get(userId, categoryId);
}

/** Articles a user has subscribed to directly. */
export function getSubscribedArticles(userId: number): ArticleWithMeta[] {
  const rows = db()
    .prepare(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug, u.name AS author_name
       FROM subscriptions s
       JOIN articles a ON a.id = s.article_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.author_id
       WHERE s.user_id = ? AND s.article_id IS NOT NULL
       ORDER BY s.created_at DESC`
    )
    .all(userId) as any[];
  return rows.map((r) => ({ ...r, tags: [] })) as ArticleWithMeta[];
}

export function getSubscribedCategories(userId: number): Category[] {
  return db()
    .prepare(
      `SELECT c.* FROM subscriptions s
       JOIN categories c ON c.id = s.category_id
       WHERE s.user_id = ? AND s.category_id IS NOT NULL
       ORDER BY c.name`
    )
    .all(userId) as Category[];
}

/** Reading history for a user (most recent first). */
export function getReadingHistory(userId: number, limit = 20): ArticleWithMeta[] {
  const rows = db()
    .prepare(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug, u.name AS author_name, rh.read_at
       FROM reading_history rh
       JOIN articles a ON a.id = rh.article_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN users u ON u.id = a.author_id
       WHERE rh.user_id = ?
       ORDER BY rh.read_at DESC
       LIMIT ?`
    )
    .all(userId, limit) as any[];
  return rows.map((r) => ({ ...r, tags: [] })) as ArticleWithMeta[];
}
