// Local-disk storage adapter — the zero-config default.
//
// Bytes are written under UPLOAD_DIR (default "<cwd>/uploads", gitignored) and
// served by the GET route at /uploads/<key>. This works in a standalone/Docker
// deploy as long as UPLOAD_DIR is a persistent, writable volume (see DEPLOYMENT).
// For multi-instance or serverless hosting, switch to the S3 adapter instead.

import { mkdir, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import type { StorageAdapter } from './types';

export function uploadDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}

export class LocalAdapter implements StorageAdapter {
  readonly kind = 'local' as const;

  async put(key: string, bytes: Buffer): Promise<void> {
    const full = join(uploadDir(), key);
    // Content-addressed: if it already exists, the bytes are identical — skip.
    try { await access(full); return; } catch { /* not present, write it */ }
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }

  publicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
