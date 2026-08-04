// Pure, dependency-free quiz helpers shared by the server action, the submit
// API route, and the test suite. Keep this file free of server-only imports
// (prisma, next/*) so it stays trivially unit-testable.

export type ParsedOption = { label: string; correct: boolean };
export type ParsedQuestion = { prompt: string; options: ParsedOption[] };

/**
 * Parse the admin textarea into questions. Blocks are separated by a blank
 * line; the first line of a block is the prompt, the rest are options. An
 * option prefixed with "*" is the correct answer (kept server-side only).
 * Blocks with fewer than 2 options are dropped. Options are capped at 8.
 */
export function parseQuizBlocks(raw: string): ParsedQuestion[] {
  return (raw || '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length >= 3) // prompt + at least 2 options
    .map((lines) => ({
      prompt: lines[0],
      options: lines.slice(1, 9).map((l) => ({
        label: l.replace(/^\*\s*/, '').trim(),
        correct: /^\*/.test(l),
      })),
    }));
}

/**
 * Resolve the quiz close time. An explicit close date wins; otherwise the
 * window is `from` + N hours (default 48, guarding against non-positive input).
 */
export function resolveClosesAt(opts: { explicit?: Date | null; hours?: number | null; from?: number }): Date {
  const { explicit, hours, from = Date.now() } = opts;
  if (explicit && !isNaN(explicit.getTime())) return explicit;
  const h = hours != null && isFinite(hours) && hours > 0 ? hours : 48;
  return new Date(from + h * 3600_000);
}

/** A quiz accepts submissions only while active and before it closes. */
export function isQuizOpen(quiz: { active: boolean; closesAt: Date | string }, now: number = Date.now()): boolean {
  return quiz.active && new Date(quiz.closesAt).getTime() > now;
}

/**
 * Keep only answers whose option id genuinely belongs to its question in this
 * quiz. `valid` maps questionId -> set of that question's option ids. Returns
 * the accepted option ids (one per validly-answered question).
 */
export function validateAnswers(answers: Record<string, string>, valid: Map<string, Set<string>>): string[] {
  const chosen: string[] = [];
  for (const [questionId, optionId] of Object.entries(answers || {})) {
    const set = valid.get(questionId);
    if (set && typeof optionId === 'string' && set.has(optionId)) chosen.push(optionId);
  }
  return chosen;
}
