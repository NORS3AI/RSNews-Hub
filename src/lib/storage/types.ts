// Pluggable asset storage — shared types.
//
// A StorageAdapter takes already-validated bytes at a content-addressed key and
// makes them retrievable at a URL. Local disk is the default (zero config); an
// S3-compatible backend (AWS S3 / Cloudflare R2) turns on via env. Adding
// Cloudinary/GCS later is just another file that implements this interface.

export interface StorageAdapter {
  /** Human-readable backend name, surfaced in the health report. */
  readonly kind: 'local' | 's3';
  /** Store bytes at `key` with the given content type. Idempotent (keys are
   *  content-addressed, so re-putting identical bytes is a harmless no-op). */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /** The URL an <img>/next-image should point at for this key. */
  publicUrl(key: string): string;
}

/** Result of a validated image upload. */
export type PutResult = { ok: true; url: string; key: string; dedup: boolean } | { ok: false; error: string };

/** A sniffed, allowed image type. */
export type ImageType = { ext: string; mime: string };
