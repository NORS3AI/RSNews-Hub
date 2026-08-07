import { checkIntegrations, type IntegrationStatus } from '@/lib/integrations';

export const dynamic = 'force-dynamic';

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
  const results = await checkIntegrations();
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
    </div>
  );
}
