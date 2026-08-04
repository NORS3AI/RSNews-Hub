import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAuthSecret, envReport } from './env';

afterEach(() => { vi.unstubAllEnvs(); });

describe('getAuthSecret', () => {
  it('falls back to a dev secret when unset in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_SECRET', '');
    expect(getAuthSecret()).toBeInstanceOf(Uint8Array);
  });

  it('throws in production when the secret is missing, a placeholder, or too short', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'change-me-to-a-long-random-string');
    expect(() => getAuthSecret()).toThrow();
    vi.stubEnv('AUTH_SECRET', 'too-short');
    expect(() => getAuthSecret()).toThrow();
  });

  it('accepts a strong secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', 'k'.repeat(48));
    expect(getAuthSecret()).toBeInstanceOf(Uint8Array);
  });
});

describe('envReport', () => {
  it('flags a weak secret and detects the DB kind', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@h:5432/db');
    const r = envReport();
    expect(r.databaseKind).toBe('postgres');
    expect(r.authSecret).toMatch(/WEAK/);
  });
});
