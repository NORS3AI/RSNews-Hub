import { prisma } from '@/lib/db';
import { saveEmailTemplate, resetEmailTemplate } from '@/lib/actions';
import { EMAIL_TEMPLATES, loadTemplateCopy, renderCopy, sampleVars } from '@/lib/emailTemplates';
import { ActionButtons } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminEmailTemplates() {
  const overridden = new Set((await prisma.emailTemplate.findMany({ select: { key: true } })).map((r) => r.key));
  const templates = await Promise.all(
    Object.values(EMAIL_TEMPLATES).map(async (def) => {
      const copy = await loadTemplateCopy(def.key);
      return { def, copy, preview: renderCopy(copy.subject, copy.body, sampleVars(def.key)), custom: overridden.has(def.key) };
    }),
  );
  const orderUrlSet = !!process.env.AD_ORDER_URL;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Email templates</h1>
      <p className="mb-3 max-w-3xl text-sm text-[var(--muted)]">
        The copy for each automated email. Edit the subject and body here — no developer needed. Use <code>{'{tags}'}</code> (listed under each) and they fill in per vendor when the email sends. Leave a template alone to use the built-in default.
      </p>
      {!orderUrlSet && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Tip: set <code>AD_ORDER_URL</code> to your JotForm ad-order link so <code>{'{submitUrl}'}</code> fills in automatically (otherwise paste the link into the body).
        </div>
      )}

      <div className="space-y-6">
        {templates.map(({ def, copy, preview, custom }) => (
          <div key={def.key} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">{def.label}</h2>
                <p className="text-sm text-[var(--muted)]">{def.description}</p>
              </div>
              <span className={`badge ${custom ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{custom ? 'Customized' : 'Default'}</span>
            </div>

            <form action={saveEmailTemplate} className="mt-4 space-y-3">
              <input type="hidden" name="key" value={def.key} />
              <div>
                <label className="label text-xs">Subject</label>
                <input name="subject" defaultValue={copy.subject} className="input" required />
              </div>
              <div>
                <label className="label text-xs">Body</label>
                <textarea name="body" defaultValue={copy.body} rows={10} className="input font-mono text-[13px] leading-relaxed" required />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {def.tags.map((t) => (
                  <span key={t.tag} className="badge bg-[var(--bg-soft)] text-[11px]" title={t.desc}><code>{`{${t.tag}}`}</code></span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-primary btn-sm">Save</button>
                {custom && <ActionButtons actions={[{ label: 'Reset to default', run: resetEmailTemplate.bind(null, def.key), confirm: `Reset “${def.label}” to the built-in default? Your custom copy is discarded.` }]} />}
              </div>
            </form>

            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card-2)] p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Preview (sample data)</div>
              <div className="text-sm font-semibold">{preview.subject}</div>
              <div className="mt-2 whitespace-pre-line text-sm text-[var(--muted)]">{preview.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
