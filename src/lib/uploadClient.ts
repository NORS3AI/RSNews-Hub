// Client-side helper: upload a file to /api/uploads and get back a URL.
//
// Replaces the old "read as data URL and inline it in the form" approach — the
// form now carries a short URL, so rows stay small and the default 1MB
// server-action body limit is never hit. Used by the admin media pickers.

export type UploadKind = 'image' | 'video';
export type UploadOutcome = { ok: true; url: string } | { ok: false; error: string };

// Kept in step with the server defaults (UPLOAD_MAX_MB / UPLOAD_VIDEO_MAX_MB).
// The server re-checks; these are just fast, friendlier client-side guards.
export const CLIENT_MAX_MB = 8;
export const CLIENT_VIDEO_MAX_MB = 20;

export async function uploadFile(file: File, kind: UploadKind = 'image'): Promise<UploadOutcome> {
  const isVideo = kind === 'video';
  const prefix = isVideo ? 'video/' : 'image/';
  const maxMb = isVideo ? CLIENT_VIDEO_MAX_MB : CLIENT_MAX_MB;
  if (!file.type.startsWith(prefix)) return { ok: false, error: `Please choose ${isVideo ? 'a video' : 'an image'} file.` };
  if (file.size > maxMb * 1024 * 1024) return { ok: false, error: `File is larger than ${maxMb}MB.` };

  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch(`/api/uploads${isVideo ? '?kind=video' : ''}`, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.url) {
      return { ok: false, error: (data && data.error) || `Upload failed (${res.status}).` };
    }
    return { ok: true, url: data.url as string };
  } catch {
    return { ok: false, error: 'Upload failed — check your connection and try again.' };
  }
}

/** Image-only convenience wrapper (existing callers). */
export const uploadImage = (file: File) => uploadFile(file, 'image');

/** Video convenience wrapper (cover video, Studio video block). */
export const uploadVideo = (file: File) => uploadFile(file, 'video');
