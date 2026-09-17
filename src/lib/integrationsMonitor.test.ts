import { describe, it, expect } from 'vitest';
import { transitions } from './integrationsMonitor';
import type { IntegrationResult, IntegrationStatus } from './integrations';

// Build a minimal results array from a {key: status} map for the diff tests.
const R = (m: Record<string, IntegrationStatus>): IntegrationResult[] =>
  Object.entries(m).map(([key, status]) => ({ key, label: key, detail: '', status, message: '' }));

describe('transitions — integration monitor diff', () => {
  it('flags a connection that just went down', () => {
    const t = transitions({ email: 'ok' }, R({ email: 'down' }));
    expect(t.newlyDown.map((r) => r.key)).toEqual(['email']);
    expect(t.recovered).toEqual([]);
  });

  it('alerts on first-ever run when something is already down (no prior state)', () => {
    const t = transitions({}, R({ email: 'down', database: 'ok' }));
    expect(t.newlyDown.map((r) => r.key)).toEqual(['email']);
    expect(t.recovered).toEqual([]);
  });

  it('does not re-alert while a connection stays down', () => {
    const t = transitions({ email: 'down' }, R({ email: 'down' }));
    expect(t.newlyDown).toEqual([]);
    expect(t.recovered).toEqual([]);
  });

  it('flags recovery when a down connection comes back (to ok)', () => {
    const t = transitions({ email: 'down' }, R({ email: 'ok' }));
    expect(t.recovered.map((r) => r.key)).toEqual(['email']);
    expect(t.newlyDown).toEqual([]);
  });

  it('treats down → unconfigured as a recovery (no longer failing)', () => {
    const t = transitions({ elevenlabs: 'down' }, R({ elevenlabs: 'unconfigured' }));
    expect(t.recovered.map((r) => r.key)).toEqual(['elevenlabs']);
    expect(t.newlyDown).toEqual([]);
  });

  it('never alerts on unconfigured / inbound / ok steady states', () => {
    const t = transitions(
      { a: 'unconfigured', b: 'inbound', c: 'ok' },
      R({ a: 'unconfigured', b: 'inbound', c: 'ok' }),
    );
    expect(t.newlyDown).toEqual([]);
    expect(t.recovered).toEqual([]);
  });

  it('does NOT flag unconfigured → down? — unconfigured means no keys, but a real down still alerts', () => {
    const t = transitions({ email: 'unconfigured' }, R({ email: 'down' }));
    expect(t.newlyDown.map((r) => r.key)).toEqual(['email']);
  });

  it('handles several connections changing at once', () => {
    const prev = { database: 'ok', email: 'down', elevenlabs: 'ok', storage: 'ok' } as Record<string, IntegrationStatus>;
    const cur = R({ database: 'down', email: 'ok', elevenlabs: 'down', storage: 'ok' });
    const t = transitions(prev, cur);
    expect(t.newlyDown.map((r) => r.key).sort()).toEqual(['database', 'elevenlabs']);
    expect(t.recovered.map((r) => r.key)).toEqual(['email']);
  });
});
