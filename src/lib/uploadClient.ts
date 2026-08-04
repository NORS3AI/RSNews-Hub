// Client-side helper: upload an image file to /api/uploads and get back a URL.
//
// Replaces the old "read as data URL and inline it in the form" approach — the
// form now carries a short URL, so rows stay small and the default 1MB
// server-action body limit is never hit. Used by the admin image pickers.

export type UploadOutcome = { ok: true; url: string } | { ok: false; error: string };

// Kept in step with the server default (UPLOAD_MAX_MB). The server re-checks;
// this is just a fast client-side guard for a friendlier message.
export const CLIENT_MAX_MB = 8;

export async function uploadImage(file: File): Promise<UploadOutcome> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Please choose an image file.' };
  if (file.size > CLIENT_MAX_MB * 1024 * 1024) return { ok: false, error: `Image is larger than ${CLIENT_MAX_MB}MB.` };

  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch('/api/uploads', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.url) {
      return { ok: false, error: (data && data.error) || `Upload failed (${res.status}).` };
    }
    return { ok: true, url: data.url as string };
  } catch {
    return { ok: false, error: 'Upload failed — check your connection and try again.' };
  }
}
