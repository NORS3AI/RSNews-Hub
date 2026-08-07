import { prisma } from './db';
import { checkIntegrations, type IntegrationResult, type IntegrationStatus } from './integrations';
import { sendEmail, renderEmail, escapeHtml, isEmailConfigured } from './email';
import { log } from './logger';

// Phase 2 of the Integrations panel: an unattended monitor. A scheduled job runs
// the same live checks the admin panel does, remembers the result, and emails the
// admin when a connection transitions into "down" (configured but not responding)
// — so a broken key/service is noticed without anyone opening the page. A matching
// "recovered" note is sent when it comes back. Only `down` is actionable:
// `unconfigured` (no keys yet) and `inbound` (they call us) never alert.

const STATE_KEY = 'integrations:monitor';

type StoredState = { at: string; statuses: Record<string, IntegrationStatus> };

export type MonitorSummary = {
  checked: number;
  down: string[];        // keys currently down
  newlyDown: string[];   // transitioned into down this run
  recovered: string[];   // transitioned out of down this run
  alerted: boolean;      // an alert email was actually sent
  recipients: number;    // how many admins were notified
  persisted: boolean;    // did we save the new baseline (false = will retry next run)
};

async function loadState(): Promise<StoredState | null> {
  const row = await prisma.setting.findUnique({ where: { key: STATE_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as StoredState;
    if (parsed && typeof parsed === 'object' && parsed.statuses) return parsed;
  } catch { /* ignore malformed state */ }
  return null;
}

async function saveState(results: IntegrationResult[], at: Date): Promise<void> {
  const statuses: Record<string, IntegrationStatus> = {};
  for (const r of results) statuses[r.key] = r.status;
  const value = JSON.stringify({ at: at.toISOString(), statuses } satisfies StoredState);
  await prisma.setting.upsert({ where: { key: STATE_KEY }, update: { value }, create: { key: STATE_KEY, value } });
}

/** The last time the monitor ran and what it saw, for the admin panel. */
export async function getMonitorState(): Promise<{ at: Date | null; statuses: Record<string, IntegrationStatus> }> {
  const s = await loadState();
  if (!s) return { at: null, statuses: {} };
  const at = new Date(s.at);
  return { at: isNaN(at.getTime()) ? null : at, statuses: s.statuses };
}

/** Who to email when a connection goes down. Priority: an explicit
 *  ADMIN_ALERT_EMAIL (comma-separated) overrides everything; otherwise every
 *  active ADMIN user; otherwise the seed admin. Deduped + validated. */
export async function alertRecipients(): Promise<string[]> {
  const out = new Set<string>();
  const env = process.env.ADMIN_ALERT_EMAIL;
  if (env) env.split(',').map((s) => s.trim()).filter(Boolean).forEach((e) => out.add(e));
  if (out.size === 0) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { email: true } });
    admins.forEach((a) => a.email && out.add(a.email));
  }
  if (out.size === 0 && process.env.SEED_ADMIN_EMAIL) out.add(process.env.SEED_ADMIN_EMAIL);
  return [...out].filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

/** Diff current check results against the last-known statuses. `newlyDown` is any
 *  connection that entered "down" (a missing prior status counts as "was up", so a
 *  connection that's already failing when monitoring turns on still alerts once);
 *  `recovered` is any that left "down". Pure — the tested core of the monitor. */
export function transitions(prev: Record<string, IntegrationStatus>, cur: IntegrationResult[]) {
  const newlyDown: IntegrationResult[] = [];
  const recovered: IntegrationResult[] = [];
  for (const r of cur) {
    const was = prev[r.key]; // undefined on first-ever run → treated as "was up"
    if (r.status === 'down' && was !== 'down') newlyDown.push(r);
    else if (r.status !== 'down' && was === 'down') recovered.push(r);
  }
  return { newlyDown, recovered };
}

function alertEmail(newlyDown: IntegrationResult[], recovered: IntegrationResult[], down: IntegrationResult[], panelUrl: string) {
  const anyDown = down.length > 0;
  const subject = newlyDown.length
    ? `⚠️ RSNews Hub: ${newlyDown.length} integration${newlyDown.length === 1 ? '' : 's'} not responding`
    : `✓ RSNews Hub: integration${recovered.length === 1 ? '' : 's'} recovered`;

  const li = (r: IntegrationResult) => `<li style="margin:4px 0"><strong>${escapeHtml(r.label)}</strong> — ${escapeHtml(r.message)}</li>`;
  const lines: string[] = [];
  const textLines: string[] = [];
  if (newlyDown.length) {
    lines.push(`<p style="margin:0 0 6px"><strong style="color:#b91c1c">Now failing:</strong></p><ul style="margin:0 0 14px;padding-left:20px">${newlyDown.map(li).join('')}</ul>`);
    textLines.push('Now failing:', ...newlyDown.map((r) => `  • ${r.label} — ${r.message}`), '');
  }
  if (recovered.length) {
    lines.push(`<p style="margin:0 0 6px"><strong style="color:#15803d">Recovered:</strong></p><ul style="margin:0 0 14px;padding-left:20px">${recovered.map(li).join('')}</ul>`);
    textLines.push('Recovered:', ...recovered.map((r) => `  • ${r.label} — ${r.message}`), '');
  }
  if (anyDown) {
    lines.push(`<p style="margin:0 0 14px;color:#7c2d12">Still down: ${down.map((r) => escapeHtml(r.label)).join(', ')}.</p>`);
    textLines.push(`Still down: ${down.map((r) => r.label).join(', ')}.`, '');
  } else {
    lines.push(`<p style="margin:0 0 14px;color:#15803d">All connections are responding again.</p>`);
    textLines.push('All connections are responding again.', '');
  }
  const link = panelUrl ? `<p style="margin:0"><a href="${escapeHtml(panelUrl)}" style="color:#E97D34;font-weight:700">Open the Integrations panel →</a></p>` : '';
  const html = renderEmail(subject.replace(/^[^A-Za-z]+/, ''), lines.join('') + link);
  const text = [subject.replace(/^[^A-Za-z]+/, ''), '', ...textLines, panelUrl ? `Open: ${panelUrl}` : ''].join('\n');
  return { subject, html, text };
}

/** Run the checks, diff against last time, and alert admins on any change into or
 *  out of "down". Never throws. State is only advanced when there is nothing to
 *  send, or an alert was successfully delivered — so a change is retried on the
 *  next run rather than silently swallowed if email is failing/unconfigured. */
export async function runIntegrationsMonitor(now: Date = new Date()): Promise<MonitorSummary> {
  const results = await checkIntegrations();
  const prev = await loadState();
  const { newlyDown, recovered } = transitions(prev?.statuses ?? {}, results);
  const down = results.filter((r) => r.status === 'down');

  let alerted = false, recipientCount = 0, persisted = false;
  const hasChange = newlyDown.length > 0 || recovered.length > 0;

  if (!hasChange) {
    await saveState(results, now);
    persisted = true;
  } else {
    const recipients = await alertRecipients();
    if (recipients.length && isEmailConfigured()) {
      const panelUrl = `${process.env.SITE_URL || ''}/admin/integrations`;
      const { subject, html, text } = alertEmail(newlyDown, recovered, down, panelUrl);
      const outcomes = await Promise.all(recipients.map((to) => sendEmail({ to, subject, html, text })));
      const delivered = outcomes.filter((o) => o.ok && !o.skipped).length;
      alerted = delivered > 0;
      recipientCount = delivered;
      // Advance the baseline only once at least one admin actually got the mail,
      // so a transient send failure re-alerts next run instead of being lost.
      if (alerted) { await saveState(results, now); persisted = true; }
      else log.warn('integration status changed but no alert delivered', { newlyDown: newlyDown.map((r) => r.key), recovered: recovered.map((r) => r.key), recipients: recipients.length });
    } else {
      // No way to notify (unconfigured email / no admins). Leave the baseline
      // untouched so the alert fires the moment email is set up.
      log.warn('integration status changed but no alert channel', { newlyDown: newlyDown.map((r) => r.key), recovered: recovered.map((r) => r.key) });
    }
  }

  return {
    checked: results.length,
    down: down.map((r) => r.key),
    newlyDown: newlyDown.map((r) => r.key),
    recovered: recovered.map((r) => r.key),
    alerted, recipients: recipientCount, persisted,
  };
}
