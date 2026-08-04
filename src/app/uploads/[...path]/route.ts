import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { uploadDir, KEY_RE, contentTypeForKey } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Serves locally-stored uploads written by the LocalAdapter. Only keys matching
// our content-addressed pattern are allowed — this rejects path traversal and
// anything that isn't one of our own objects. When S3/R2 is configured, image
// URLs point straight at the bucket/CDN and this route is not used.
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const key = (params.path || []).join('/');
  if (!KEY_RE.test(key)) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await readFile(join(uploadDir(), key));
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeForKey(key),
        // Immutable: the key is a hash of the content, so it can never change.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
