import { checkIntegrations, type IntegrationStatus } from '@/lib/integrations';
import { getMonitorState } from '@/lib/integrationsMonitor';

export const dynamic = 'force-dynamic';

function ago(d: Date): string {
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (h < 1) return 'under an hour ago';
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DOT: Record<IntegrationStatus, string> = {
  ok: 'bg-green-500', down: 'bg-red-500', unconfigured: 'bg-slate-300 dark:bg-slate-600', inbound: 'bg-blue-500',
};
const BADGE: Record<IntegrationStatus, { text: string; cls: string }> = {
  ok: { text: 'Connected', cls: 'bg-green-100 text-green-700' },
  down: { text: 'Not responding', cls: 'bg-red-100 text-red-700' },
  unconfigured: { text: 'Not set up', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  inbound: { text: 'Inbound', cls: 'bg-blue-100 text-blue-700' },
};

export default async function AdminIntegrations() {
  const [results, monitor] = await Promise.all([checkIntegrations(), getMonitorState()]);
  const down = results.filter((r) => r.status === 'down').length;

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Integrations</h1>
        {/* Re-runs the live checks (this page checks on every load). */}
        <a href="/admin/integrations" className="btn-outline btn-sm">Re-test all</a>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-[var(--muted)]">
        Every external service the hub talks to, checked live right now. <span className="font-semibold text-green-700">Connected</span> = responding · <span className="font-semibold text-red-700">Not responding</span> = configured but failing · <span className="font-semibold">Not set up</span> = no keys yet · <span className="font-semibold text-blue-700">Inbound</span> = they call us (shown by last activity).
      </p>

      {down > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <strong>{down} connection{down === 1 ? '' : 's'} not responding.</strong> Check the key/service below.
        </div>
      )}

      <div className="space-y-2">
        {results.map((r) => (
          <div key={r.key} className="card flex items-center gap-3 p-4">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[r.status]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{r.label}</span>
                <span className={`badge ${BADGE[r.status].cls}`}>{BADGE[r.status].text}</span>
              </div>
              <div className="text-xs text-[var(--muted)]">{r.detail}</div>
              <div className="mt-0.5 text-sm">{r.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Phase 2: the unattended monitor. A scheduled job re-runs these checks and
          emails admins on any change into/out of "down". This line shows it's alive. */}
      <p className="mt-5 text-xs text-[var(--muted)]">
        {monitor.at
          ? <>Automated monitor last ran <strong>{ago(monitor.at)}</strong> — it emails an admin when a connection goes down or recovers.</>
          : <>Automated monitor hasn’t run yet. Schedule <code className="rounded bg-[var(--panel)] px-1">POST /api/cron/integrations</code> (see the dashboard’s scheduled-jobs tile) to get email alerts when a connection goes down.</>}
      </p>
    </div>
  );
}
