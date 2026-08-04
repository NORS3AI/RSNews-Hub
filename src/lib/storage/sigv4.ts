// Minimal AWS Signature V4 for S3 PUT — no SDK, just Node crypto.
//
// Implements exactly what an S3-compatible "PutObject" needs (single request,
// payload hash in the header). Works for AWS S3 and Cloudflare R2 (path-style).
// The pure derivation pieces are unit-tested against AWS's published test vector.

import { createHash, createHmac } from 'crypto';

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * Derive the SigV4 signing key: HMAC chain over date → region → service →
 * "aws4_request", seeded with "AWS4"+secret. (AWS docs "deriveSigningKey".)
 */
export function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/** Sign a prepared string-to-sign with a derived key → hex signature. */
export function signStringToSign(signingKey: Buffer, stringToSign: string): string {
  return createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
}

// RFC 3986 encoding of a single path segment (S3 canonical URI rules): encode
// everything except unreserved chars, and (for the URI) keep "/" as separators
// by encoding segment-by-segment.
function encodeSegment(seg: string): string {
  return encodeURIComponent(seg).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
export function encodeS3Path(path: string): string {
  return path.split('/').map(encodeSegment).join('/');
}

export type SigV4Input = {
  method: string;
  host: string;
  canonicalUri: string; // already begins with "/", not yet percent-encoded
  region: string;
  service: string; // 's3'
  accessKeyId: string;
  secretAccessKey: string;
  contentType: string;
  body: Buffer;
  amzDate: string; // YYYYMMDDTHHMMSSZ
  dateStamp: string; // YYYYMMDD
};

/** Build the Authorization header + the signed headers for an S3 request. */
export function signRequest(i: SigV4Input): Record<string, string> {
  const payloadHash = sha256Hex(i.body);
  const canonicalUri = encodeS3Path(i.canonicalUri);
  const canonicalHeaders =
    `content-type:${i.contentType}\n` +
    `host:${i.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${i.amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [i.method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${i.dateStamp}/${i.region}/${i.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', i.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = deriveSigningKey(i.secretAccessKey, i.dateStamp, i.region, i.service);
  const signature = signStringToSign(signingKey, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    'x-amz-date': i.amzDate,
    'x-amz-content-sha256': payloadHash,
    'Content-Type': i.contentType,
  };
}

/** Split a Date into the two timestamp formats SigV4 needs. */
export function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}
