import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { putImage, maxUploadBytes, storageMode } from '@/lib/storage';
import { captureError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
// Uploaded images can be larger than the default action/body limit; keep this
// route on the Node runtime so Buffer + fs (local adapter) are available.
export const runtime = 'nodejs';

// Admin-only image upload. Accepts multipart FormData with a single `file`,
// validates it (magic-byte sniff + size cap) and stores it via the active
// backend (local disk by default, S3/R2 when configured). Returns { url }.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let file: unknown;
  try {
    const form = await req.formData();
    file = form.get('file');
  } catch {
    return NextResponse.json({ ok: false, error: 'expected multipart form data' }, { status: 400 });
  }
  if (!(file instanceof Blob) || (file instanceof File && file.size === 0)) {
    return NextResponse.json({ ok: false, error: 'no file provided' }, { status: 400 });
  }
  // Cheap pre-check before buffering: reject oversized uploads up front.
  if (file.size > maxUploadBytes()) {
    return NextResponse.json({ ok: false, error: `file too large (max ${(maxUploadBytes() / 1048576).toFixed(0)}MB)` }, { status: 413 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await putImage(bytes);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    return NextResponse.json({ ok: true, url: result.url, backend: storageMode() });
  } catch (e) {
    captureError(e, { route: 'uploads' });
    return NextResponse.json({ ok: false, error: 'upload failed' }, { status: 500 });
  }
}
