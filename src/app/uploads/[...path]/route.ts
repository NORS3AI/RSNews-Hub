import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { uploadDir, isServableKey, contentTypeForKey } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Serves locally-stored uploads written by the LocalAdapter. Only keys matching
// our content-addressed pattern are allowed — this rejects path traversal and
// anything that isn't one of our own objects. When S3/R2 is configured, image
// URLs point straight at the bucket/CDN and this route is not used.
export async function GET(_req: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const key = (params.path || []).join('/');
  if (!isServableKey(key)) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await readFile(join(uploadDir(), key));
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeForKey(key),
        'X-Content-Type-Options': 'nosniff',
        // A strict sandbox CSP for served assets (neuters any opt-in SVG) is set
        // centrally in middleware.ts for the /uploads path.
        // Immutable: the key is a hash of the content, so it can never change.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
