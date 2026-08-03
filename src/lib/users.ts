import bcrypt from 'bcryptjs';
import { getDb } from './db';
import type { Role, User, UserStatus } from './types';

const db = () => getDb();

const PUBLIC_FIELDS = 'id, name, email, role, status, created_at, updated_at';

export function listUsers(search?: string): User[] {
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    return db()
      .prepare(
        `SELECT ${PUBLIC_FIELDS} FROM users
         WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ?
         ORDER BY created_at DESC`
      )
      .all(q, q) as User[];
  }
  return db().prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`).all() as User[];
}

export function getUserById(id: number): User | null {
  return (db().prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id) as User) || null;
}

export function getUserByEmail(email: string): (User & { password: string }) | null {
  return (
    (db()
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as User & { password: string }) || null
  );
}

export function countUsers(): number {
  return (db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
  status?: UserStatus;
}

export function createUser(input: CreateUserInput): User {
  const hash = bcrypt.hashSync(input.password, 10);
  const info = db()
    .prepare(
      `INSERT INTO users (name, email, password, role, status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.email.toLowerCase().trim(),
      hash,
      input.role || 'user',
      input.status || 'active'
    );
  return getUserById(Number(info.lastInsertRowid))!;
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  status?: UserStatus;
  password?: string;
}

export function updateUser(id: number, input: UpdateUserInput): void {
  const existing = getUserByEmail(getUserById(id)?.email || '');
  if (!existing) throw new Error('User not found');
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (input.name !== undefined) {
    sets.push('name = @name');
    params.name = input.name.trim();
  }
  if (input.email !== undefined) {
    sets.push('email = @email');
    params.email = input.email.toLowerCase().trim();
  }
  if (input.role !== undefined) {
    sets.push('role = @role');
    params.role = input.role;
  }
  if (input.status !== undefined) {
    sets.push('status = @status');
    params.status = input.status;
  }
  if (input.password) {
    sets.push('password = @password');
    params.password = bcrypt.hashSync(input.password, 10);
  }
  if (!sets.length) return;
  sets.push(`updated_at = datetime('now')`);
  db().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

export function setUserStatus(id: number, status: UserStatus): void {
  db().prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
}

export function deleteUser(id: number): void {
  db().prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function emailExists(email: string): boolean {
  return !!db().prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase().trim());
}
