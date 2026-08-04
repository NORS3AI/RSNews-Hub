// S3-compatible storage adapter (AWS S3 + Cloudflare R2) — no SDK.
//
// One PutObject per upload, signed with SigV4 (see sigv4.ts). Selection and
// config are env-driven; misconfiguration throws only at first use (never at
// build). The bucket must be readable at the returned URL — either a public
// bucket policy or a CDN / custom domain set via S3_PUBLIC_URL.

import type { StorageAdapter } from './types';
import { signRequest, amzDates } from './sigv4';

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;       // origin, no trailing slash, e.g. https://s3.us-east-1.amazonaws.com
  host: string;           // Host header for signing
  pathStyle: boolean;     // R2 + custom endpoints use path-style
  publicBase: string;     // base URL for returned public links, no trailing slash
};

/** Resolve S3 config from env. Throws if a required value is missing. */
export function s3Config(): S3Config {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage selected but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not all set');
  }
  const region = process.env.S3_REGION || 'us-east-1';
  const rawEndpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, '') || `https://s3.${region}.amazonaws.com`;
  // Path-style when a custom endpoint is given (R2/MinIO) or explicitly forced.
  const pathStyle = process.env.S3_FORCE_PATH_STYLE === 'true' || !!process.env.S3_ENDPOINT;
  const endpointHost = new URL(rawEndpoint).host;
  const host = pathStyle ? endpointHost : `${bucket}.${endpointHost}`;

  const publicBase = (process.env.S3_PUBLIC_URL?.replace(/\/+$/, '')) ||
    (pathStyle ? `${rawEndpoint}/${bucket}` : `https://${host}`);

  return { bucket, region, accessKeyId, secretAccessKey, endpoint: rawEndpoint, host, pathStyle, publicBase };
}

export class S3Adapter implements StorageAdapter {
  readonly kind = 's3' as const;
  private cfg: S3Config;
  constructor(cfg?: S3Config) { this.cfg = cfg || s3Config(); }

  private putUrl(key: string): string {
    return this.cfg.pathStyle
      ? `${this.cfg.endpoint}/${this.cfg.bucket}/${key}`
      : `https://${this.cfg.host}/${key}`;
  }
  private canonicalUri(key: string): string {
    return this.cfg.pathStyle ? `/${this.cfg.bucket}/${key}` : `/${key}`;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const { amzDate, dateStamp } = amzDates(new Date());
    const headers = signRequest({
      method: 'PUT', host: this.cfg.host, canonicalUri: this.canonicalUri(key),
      region: this.cfg.region, service: 's3',
      accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey,
      contentType, body: bytes, amzDate, dateStamp,
    });
    // Copy into a fresh Uint8Array (plain ArrayBuffer-backed) and wrap in a Blob:
    // Node's Buffer.buffer is ArrayBufferLike, which the DOM lib's BodyInit rejects.
    // The signed Content-Type is carried by the headers, not the Blob.
    const res = await fetch(this.putUrl(key), { method: 'PUT', headers, body: new Blob([new Uint8Array(bytes)]) });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`S3 PUT failed: ${res.status} ${detail.slice(0, 200)}`);
    }
  }

  publicUrl(key: string): string {
    return `${this.cfg.publicBase}/${key}`;
  }
}
