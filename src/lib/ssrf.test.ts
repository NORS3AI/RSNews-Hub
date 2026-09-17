import { describe, it, expect } from 'vitest';
import { isPrivateIPv4, isPrivateIPv6, isPrivateIp, assertPublicHttpUrl, SsrfError } from './ssrf';

describe('isPrivateIPv4', () => {
  it('flags loopback, private, link-local, CGNAT and reserved ranges', () => {
    for (const ip of [
      '127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', '0.0.0.0', '192.0.2.5', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    ]) expect(isPrivateIPv4(ip), ip).toBe(true);
  });
  it('allows ordinary public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '192.169.0.1', '100.63.255.255'])
      expect(isPrivateIPv4(ip), ip).toBe(false);
  });
  it('treats malformed input as unsafe', () => {
    expect(isPrivateIPv4('999.1.1.1')).toBe(true);
    expect(isPrivateIPv4('nope')).toBe(true);
  });
});

describe('isPrivateIPv6', () => {
  it('flags loopback, ULA, link-local, multicast', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1'])
      expect(isPrivateIPv6(ip), ip).toBe(true);
  });
  it('delegates IPv4-mapped / NAT64 to the v4 check', () => {
    expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false);
  });
  it('allows public IPv6', () => {
    expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('routes by family and rejects non-IPs', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('assertPublicHttpUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicHttpUrl('ftp://example.com')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects embedded credentials', async () => {
    await expect(assertPublicHttpUrl('http://user:pass@example.com')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects private IP literals without DNS', async () => {
    await expect(assertPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicHttpUrl('http://127.0.0.1:8080/')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicHttpUrl('http://[::1]/')).rejects.toBeInstanceOf(SsrfError);
  });
  it('rejects a garbage URL', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(SsrfError);
  });
});
