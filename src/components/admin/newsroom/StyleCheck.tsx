'use client';
import { useMemo, useState } from 'react';
import { checkHouseStyle, applySuggestion, applyAll, ruleMessage, type HouseStyleRule } from '@/lib/houseStyle';
import { Sparkles, Check, Book } from '@/components/icons';

// The house-style panel: runs the admin-editable rule book over the current draft
// and offers one-click fixes (never a silent rewrite). Applying a fix hands the
// corrected text back up; the suggestion list re-derives from the new text.
export default function StyleCheck({ text, rules, onChange }: { text: string; rules: HouseStyleRule[]; onChange: (t: string) => void }) {
  const suggestions = useMemo(() => checkHouseStyle(text, rules), [text, rules]);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles width={15} height={15} className="text-brand-600" />
          RS Dictionary
          <span className={`badge ${suggestions.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {suggestions.length ? `${suggestions.length} to review` : 'All clear'}
          </span>
        </div>
        {suggestions.length > 1 && (
          <button type="button" className="btn-outline btn-sm" onClick={() => onChange(applyAll(text, suggestions))}>
            <Check width={13} height={13} /> Fix all
          </button>
        )}
      </div>

      {suggestions.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {suggestions.map((s, i) => (
            <li key={`${s.start}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1.5">
              <div className="min-w-0 text-sm">
                <span className="rounded bg-red-100 px-1 font-mono text-[12px] text-red-700 line-through dark:bg-red-950/40 dark:text-red-300">{s.found.trim()}</span>
                <span className="mx-1.5 text-[var(--muted)]">→</span>
                <span className="rounded bg-emerald-100 px-1 font-mono text-[12px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{s.replacement.trim()}</span>
                <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{s.message}</div>
              </div>
              <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => onChange(applySuggestion(text, s))}>Fix</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">No house-style issues found in this draft.</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={() => setShowRules((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--fg)]">
          <Book width={12} height={12} /> {showRules ? 'Hide' : 'View'} the rule book ({rules.length} terms + Oxford comma)
        </button>
        <a href="/admin/house-style" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-brand-600 hover:underline">Manage rules →</a>
      </div>
      {showRules && (
        <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted)]">
          {rules.map((r) => (
            <li key={r.canonical}><b className="text-[var(--fg)]">{r.canonical}</b> — {ruleMessage(r)}</li>
          ))}
          <li><b className="text-[var(--fg)]">Oxford comma</b> — Add the serial comma before “and”/“or” in a list of three or more.</li>
        </ul>
      )}
    </div>
  );
}
