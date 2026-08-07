import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IntegrationResult, IntegrationStatus } from './integrations';

// Mock the monitor's three dependencies so we can drive the orchestration:
// the live checks, the Setting/User store, and email delivery.
const { checkIntegrations, prisma, sendEmail, isEmailConfigured } = vi.hoisted(() => ({
  checkIntegrations: vi.fn(),
  prisma: {
    setting: { findUnique: vi.fn(), upsert: vi.fn() },
    user: { findMany: vi.fn() },
  },
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
}));
vi.mock('./integrations', () => ({ checkIntegrations }));
vi.mock('./db', () => ({ prisma }));
vi.mock('./email', () => ({
  sendEmail, isEmailConfigured,
  renderEmail: (t: string, b: string) => `${t}${b}`,
  escapeHtml: (s: string) => s,
}));
vi.mock('./logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, captureError: vi.fn() }));

import { runIntegrationsMonitor } from './integrationsMonitor';

const results = (m: Record<string, IntegrationStatus>): IntegrationResult[] =>
  Object.entries(m).map(([key, status]) => ({ key, label: key, detail: '', status, message: 'msg' }));
const storedAs = (m: Record<string, IntegrationStatus>) =>
  ({ key: 'integrations:monitor', value: JSON.stringify({ at: new Date().toISOString(), statuses: m }) });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_ALERT_EMAIL;
  delete process.env.SEED_ADMIN_EMAIL;
  isEmailConfigured.mockReturnValue(true);
  sendEmail.mockResolvedValue({ ok: true });
  prisma.user.findMany.mockResolvedValue([{ email: 'admin@rs.test' }]);
  prisma.setting.upsert.mockResolvedValue({});
});

describe('runIntegrationsMonitor — orchestration', () => {
  it('emails admins and advances the baseline when a connection goes down', async () => {
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'down' }));

    const r = await runIntegrationsMonitor();

    expect(r.newlyDown).toEqual(['email']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('admin@rs.test');
    expect(r.alerted).toBe(true);
    expect(r.recipients).toBe(1);
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1); // baseline saved
    expect(r.persisted).toBe(true);
  });

  it('does NOT advance the baseline when the alert email fails (so it retries)', async () => {
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'down' }));
    sendEmail.mockResolvedValue({ ok: false, error: 'transport' });

    const r = await runIntegrationsMonitor();

    expect(r.newlyDown).toEqual(['email']);
    expect(r.alerted).toBe(false);
    expect(prisma.setting.upsert).not.toHaveBeenCalled(); // deferred, not swallowed
    expect(r.persisted).toBe(false);
  });

  it('defers (no send, no persist) when email is unconfigured', async () => {
    isEmailConfigured.mockReturnValue(false);
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'down' }));

    const r = await runIntegrationsMonitor();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(r.alerted).toBe(false);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
    expect(r.persisted).toBe(false);
  });

  it('a skipped (no-op) send does not count as delivered and does not persist', async () => {
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'down' }));
    sendEmail.mockResolvedValue({ ok: true, skipped: true });

    const r = await runIntegrationsMonitor();

    expect(r.alerted).toBe(false);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it('sends a recovery note and persists when a down connection comes back', async () => {
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'down' }));
    checkIntegrations.mockResolvedValue(results({ email: 'ok' }));

    const r = await runIntegrationsMonitor();

    expect(r.recovered).toEqual(['email']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(r.persisted).toBe(true);
  });

  it('no change → no email, baseline refreshed', async () => {
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok', database: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'ok', database: 'ok' }));

    const r = await runIntegrationsMonitor();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(r.alerted).toBe(false);
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    expect(r.persisted).toBe(true);
  });

  it('ADMIN_ALERT_EMAIL overrides the admin-user lookup and supports multiple recipients', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'a@x.test, b@x.test';
    prisma.setting.findUnique.mockResolvedValue(storedAs({ email: 'ok' }));
    checkIntegrations.mockResolvedValue(results({ email: 'down' }));

    const r = await runIntegrationsMonitor();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c: any[]) => c[0].to).sort()).toEqual(['a@x.test', 'b@x.test']);
    expect(r.recipients).toBe(2);
  });

  it('first-ever run with no prior state still alerts on an already-down connection', async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    checkIntegrations.mockResolvedValue(results({ email: 'down', database: 'ok' }));

    const r = await runIntegrationsMonitor();

    expect(r.newlyDown).toEqual(['email']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
