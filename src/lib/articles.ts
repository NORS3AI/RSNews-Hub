import { getDb } from './db';
import { slugify, uniqueSlug } from './slug';
import type { Article, ArticleStatus, ArticleWithMeta, Category, Tag } from './types';

const db = () => getDb();

const SELECT_META = `
  SELECT a.*,
         c.name AS category_name,
         c.slug AS category_slug,
         u.name AS author_name
  FROM articles a
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN users u ON u.id = a.author_id
`;

function hydrateTags(article: any): ArticleWithMeta {
  const tags = db()
    .prepare(
      `SELECT t.* FROM tags t
       JOIN article_tags at ON at.tag_id = t.id
       WHERE at.article_id = ? ORDER BY t.name`
    )
    .all(article.id) as Tag[];
  return { ...article, tags } as ArticleWithMeta;
}

export function getArticleBySlug(slug: string): ArticleWithMeta | null {
  const row = db().prepare(`${SELECT_META} WHERE a.slug = ?`).get(slug);
  return row ? hydrateTags(row) : null;
}

export function getArticleById(id: number): ArticleWithMeta | null {
  const row = db().prepare(`${SELECT_META} WHERE a.id = ?`).get(id);
  return row ? hydrateTags(row) : null;
}

export interface ListOptions {
  status?: ArticleStatus | ArticleStatus[];
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'published_at' | 'views' | 'created_at' | 'title';
  order?: 'ASC' | 'DESC';
}

export function listArticles(opts: ListOptions = {}): ArticleWithMeta[] {
  const where: string[] = [];
  const params: any[] = [];

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    where.push(`a.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (opts.categorySlug) {
    where.push('c.slug = ?');
    params.push(opts.categorySlug);
  }
  if (opts.tagSlug) {
    where.push(
      'a.id IN (SELECT at.article_id FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE t.slug = ?)'
    );
    params.push(opts.tagSlug);
  }
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    where.push('(LOWER(a.title) LIKE ? OR LOWER(a.excerpt) LIKE ? OR LOWER(a.body) LIKE ?)');
    params.push(q, q, q);
  }

  const orderBy = opts.orderBy || 'published_at';
  const order = opts.order || 'DESC';
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const sql = `${SELECT_META}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.${orderBy} ${order}, a.id DESC
    LIMIT ? OFFSET ?`;
  const rows = db().prepare(sql).all(...params, limit, offset);
  return rows.map(hydrateTags);
}

export function countArticles(opts: ListOptions = {}): number {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    where.push(`a.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    where.push('(LOWER(a.title) LIKE ? OR LOWER(a.excerpt) LIKE ? OR LOWER(a.body) LIKE ?)');
    params.push(q, q, q);
  }
  const sql = `SELECT COUNT(*) AS n FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const row = db().prepare(sql).get(...params) as { n: number };
  return row.n;
}

/** The next published article after the given one (by publish date), for "read next". */
export function getNextArticle(article: Article): ArticleWithMeta | null {
  const row = db()
    .prepare(
      `${SELECT_META}
       WHERE a.status = 'published'
         AND (a.published_at, a.id) < (?, ?)
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT 1`
    )
    .get(article.published_at, article.id);
  if (row) return hydrateTags(row);
  // wrap around to the newest article if we are at the end
  const first = db()
    .prepare(
      `${SELECT_META} WHERE a.status = 'published' AND a.id != ?
       ORDER BY a.published_at DESC, a.id DESC LIMIT 1`
    )
    .get(article.id);
  return first ? hydrateTags(first) : null;
}

export function getPreviousArticle(article: Article): ArticleWithMeta | null {
  const row = db()
    .prepare(
      `${SELECT_META}
       WHERE a.status = 'published'
         AND (a.published_at, a.id) > (?, ?)
       ORDER BY a.published_at ASC, a.id ASC
       LIMIT 1`
    )
    .get(article.published_at, article.id);
  return row ? hydrateTags(row) : null;
}

/**
 * "If you read this, this might interest you."
 *
 * Content-based similarity: score other published articles by shared tags
 * (weighted heavily) and shared category. This is deterministic and needs no
 * external service, which suits an embeddable widget.
 */
export function getRelatedArticles(article: Article, limit = 4): ArticleWithMeta[] {
  const rows = db()
    .prepare(
      `${SELECT_META}
       WHERE a.status = 'published' AND a.id != @id
       ORDER BY
         (
           -- shared tags, weighted x3
           3 * (SELECT COUNT(*) FROM article_tags t1
                JOIN article_tags t2 ON t1.tag_id = t2.tag_id
                WHERE t1.article_id = a.id AND t2.article_id = @id)
           -- same category, weighted x2
           + 2 * (CASE WHEN a.category_id = @cat AND @cat IS NOT NULL THEN 1 ELSE 0 END)
         ) DESC,
         a.views DESC,
         a.published_at DESC
       LIMIT @limit`
    )
    .all({ id: article.id, cat: article.category_id, limit });
  return rows.map(hydrateTags);
}

/**
 * Personalised recommendations for a logged-in user, based on the tags and
 * categories of articles they have already read.
 */
export function getRecommendationsForUser(userId: number, limit = 6): ArticleWithMeta[] {
  const rows = db()
    .prepare(
      `${SELECT_META}
       WHERE a.status = 'published'
         AND a.id NOT IN (SELECT article_id FROM reading_history WHERE user_id = @uid)
       ORDER BY
         (
           3 * (SELECT COUNT(*) FROM article_tags at
                WHERE at.article_id = a.id
                  AND at.tag_id IN (
                    SELECT DISTINCT at2.tag_id FROM article_tags at2
                    JOIN reading_history rh ON rh.article_id = at2.article_id
                    WHERE rh.user_id = @uid))
           + 2 * (CASE WHEN a.category_id IN (
                    SELECT DISTINCT a2.category_id FROM articles a2
                    JOIN reading_history rh ON rh.article_id = a2.id
                    WHERE rh.user_id = @uid) THEN 1 ELSE 0 END)
         ) DESC,
         a.views DESC,
         a.published_at DESC
       LIMIT @limit`
    )
    .all({ uid: userId, limit });
  return rows.map(hydrateTags);
}

export function incrementViews(articleId: number): void {
  db().prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(articleId);
}

export function recordRead(userId: number, articleId: number): void {
  db()
    .prepare(
      `INSERT INTO reading_history (user_id, article_id) VALUES (?, ?)
       ON CONFLICT(user_id, article_id) DO UPDATE SET read_at = datetime('now')`
    )
    .run(userId, articleId);
}

export interface ArticleInput {
  title: string;
  excerpt?: string;
  body?: string;
  cover_image?: string;
  category_id?: number | null;
  author_id?: number | null;
  status?: ArticleStatus;
  tagNames?: string[];
  slug?: string;
}

function syncTags(articleId: number, tagNames: string[]): void {
  db().prepare('DELETE FROM article_tags WHERE article_id = ?').run(articleId);
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    let tag = db().prepare('SELECT * FROM tags WHERE slug = ?').get(slug) as Tag | undefined;
    if (!tag) {
      const info = db().prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
      tag = { id: Number(info.lastInsertRowid), name, slug };
    }
    db()
      .prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)')
      .run(articleId, tag.id);
  }
}

export function createArticle(input: ArticleInput): number {
  const slug =
    input.slug?.trim() ||
    uniqueSlug(input.title, (s) => !!db().prepare('SELECT 1 FROM articles WHERE slug = ?').get(s));
  const status = input.status || 'draft';
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  const info = db()
    .prepare(
      `INSERT INTO articles (title, slug, excerpt, body, cover_image, category_id, author_id, status, published_at)
       VALUES (@title, @slug, @excerpt, @body, @cover_image, @category_id, @author_id, @status, @published_at)`
    )
    .run({
      title: input.title,
      slug,
      excerpt: input.excerpt || '',
      body: input.body || '',
      cover_image: input.cover_image || '',
      category_id: input.category_id ?? null,
      author_id: input.author_id ?? null,
      status,
      published_at: publishedAt,
    });
  const id = Number(info.lastInsertRowid);
  syncTags(id, input.tagNames || []);
  return id;
}

export function updateArticle(id: number, input: ArticleInput): void {
  const existing = getArticleById(id);
  if (!existing) throw new Error('Article not found');
  const status = input.status || existing.status;
  // Set published_at when transitioning into published for the first time.
  let publishedAt = existing.published_at;
  if (status === 'published' && !existing.published_at) {
    publishedAt = new Date().toISOString();
  }
  db()
    .prepare(
      `UPDATE articles SET
        title = @title, excerpt = @excerpt, body = @body, cover_image = @cover_image,
        category_id = @category_id, status = @status, published_at = @published_at,
        updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({
      id,
      title: input.title ?? existing.title,
      excerpt: input.excerpt ?? existing.excerpt,
      body: input.body ?? existing.body,
      cover_image: input.cover_image ?? existing.cover_image,
      category_id: input.category_id === undefined ? existing.category_id : input.category_id,
      status,
      published_at: publishedAt,
    });
  if (input.tagNames) syncTags(id, input.tagNames);
}

export function setArticleStatus(id: number, status: ArticleStatus): void {
  const publishedPatch =
    status === 'published'
      ? `, published_at = COALESCE(published_at, datetime('now'))`
      : '';
  db()
    .prepare(`UPDATE articles SET status = ?, updated_at = datetime('now')${publishedPatch} WHERE id = ?`)
    .run(status, id);
}

export function deleteArticle(id: number): void {
  db().prepare('DELETE FROM articles WHERE id = ?').run(id);
}

/** Published articles grouped by year-month for the archive page. */
export function getArchive(): { period: string; articles: ArticleWithMeta[] }[] {
  const rows = listArticles({ status: 'published', limit: 500 });
  const groups = new Map<string, ArticleWithMeta[]>();
  for (const a of rows) {
    const d = a.published_at ? new Date(a.published_at) : new Date(a.created_at);
    const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  return Array.from(groups.entries()).map(([period, articles]) => ({ period, articles }));
}

// ---- Categories ----------------------------------------------------------

export function listCategories(): Category[] {
  return db().prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  return (db().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as Category) || null;
}

export function createCategory(name: string, description = ''): number {
  const slug = uniqueSlug(name, (s) => !!db().prepare('SELECT 1 FROM categories WHERE slug = ?').get(s));
  const info = db()
    .prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)')
    .run(name, slug, description);
  return Number(info.lastInsertRowid);
}

export function deleteCategory(id: number): void {
  db().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// ---- Tags ----------------------------------------------------------------

export function listTags(): Tag[] {
  return db().prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}
