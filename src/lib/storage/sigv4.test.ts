import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'crypto';
import { deriveSigningKey, signStringToSign, encodeS3Path, amzDates, signRequest, sha256Hex } from './sigv4';

// Independent, from-the-spec reference implementation of the SigV4 key
// derivation, written in a deliberately different style than the module under
// test. If the module agrees with this second implementation across varied
// inputs, both implement the AWS-documented HMAC chain correctly (differential
// testing — the standard way to validate a crypto routine without live creds).
function refSignature(secret: string, dateStamp: string, region: string, service: string, sts: string): string {
  const mac = (key: Buffer | string, msg: string) => createHmac('sha256', key).update(msg).digest();
  const kDate = mac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = mac(kDate, region);
  const kService = mac(kRegion, service);
  const kSigning = mac(kService, 'aws4_request');
  return createHmac('sha256', kSigning).update(sts).digest('hex');
}

describe('SigV4 derivation (differential vs. independent reference)', () => {
  const cases = [
    { secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', date: '20150830', region: 'us-east-1', service: 's3' },
    { secret: 'another-secret-value-123', date: '20240101', region: 'eu-west-2', service: 's3' },
    { secret: 'r2-token', date: '20260101', region: 'auto', service: 's3' },
  ];
  it('matches the reference signature for every case', () => {
    for (const c of cases) {
      const sts = ['AWS4-HMAC-SHA256', `${c.date}T000000Z`, `${c.date}/${c.region}/${c.service}/aws4_request`, sha256Hex('canonical-request')].join('\n');
      const mine = signStringToSign(deriveSigningKey(c.secret, c.date, c.region, c.service), sts);
      expect(mine).toBe(refSignature(c.secret, c.date, c.region, c.service, sts));
      expect(mine).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('the signing key is a 32-byte HMAC-SHA256 output', () => {
    expect(deriveSigningKey('s', '20240101', 'us-east-1', 's3')).toHaveLength(32);
  });

  it('sha256Hex matches Node crypto exactly (primitive anchor)', () => {
    const data = Buffer.from('the quick brown fox');
    expect(sha256Hex(data)).toBe(createHash('sha256').update(data).digest('hex'));
  });
});

describe('sha256Hex', () => {
  it('hashes the empty payload to the well-known constant', () => {
    // AWS uses this exact value for an empty body's x-amz-content-sha256.
    expect(sha256Hex(Buffer.alloc(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('encodeS3Path', () => {
  it('encodes each segment but keeps the slashes', () => {
    expect(encodeS3Path('/images/ab/cd.png')).toBe('/images/ab/cd.png');
    expect(encodeS3Path('/my bucket/a+b.png')).toBe('/my%20bucket/a%2Bb.png');
  });
});

describe('amzDates', () => {
  it('formats both timestamps from a Date', () => {
    const { amzDate, dateStamp } = amzDates(new Date('2015-08-30T12:36:00.000Z'));
    expect(amzDate).toBe('20150830T123600Z');
    expect(dateStamp).toBe('20150830');
  });
});

describe('signRequest', () => {
  it('produces the expected header set with a valid Authorization', () => {
    const headers = signRequest({
      method: 'PUT', host: 'my-bucket.s3.us-east-1.amazonaws.com', canonicalUri: '/images/ab/cd.png',
      region: 'us-east-1', service: 's3', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      contentType: 'image/png', body: Buffer.from('hello'),
      amzDate: '20150830T123600Z', dateStamp: '20150830',
    });
    expect(headers['x-amz-content-sha256']).toBe(sha256Hex(Buffer.from('hello')));
    expect(headers['x-amz-date']).toBe('20150830T123600Z');
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  });
});
