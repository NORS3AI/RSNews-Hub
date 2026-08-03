import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Single shared SQLite connection.
 *
 * We keep the instance on `globalThis` so that Next.js hot-reload in dev does
 * not open a new file handle on every module reload.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rsnewsDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH || './data/rsnews.db';
  const abs = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

function createConnection(): Database.Database {
  const db = new Database(resolveDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL UNIQUE,
      password     TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'user',   -- 'admin' | 'editor' | 'user'
      status       TEXT    NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'banned'
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL,
      slug   TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS articles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      slug         TEXT NOT NULL UNIQUE,
      excerpt      TEXT NOT NULL DEFAULT '',
      body         TEXT NOT NULL DEFAULT '',
      cover_image  TEXT NOT NULL DEFAULT '',
      category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status       TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'published' | 'archived' | 'trashed'
      views        INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      body       TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'draft',      -- 'draft' | 'published' | 'trashed'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- A user subscribing to a single article (notify on updates / save for later).
    CREATE TABLE IF NOT EXISTS subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, article_id),
      UNIQUE (user_id, category_id)
    );

    -- Which articles a user has read; powers "if you read this..." recommendations.
    CREATE TABLE IF NOT EXISTS reading_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      read_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, article_id)
    );

    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_reading_user ON reading_history(user_id);
  `);
}

export function getDb(): Database.Database {
  if (!global.__rsnewsDb) {
    global.__rsnewsDb = createConnection();
  }
  return global.__rsnewsDb;
}
