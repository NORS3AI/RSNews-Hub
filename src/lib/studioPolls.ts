import { prisma } from './db';
import type { ModuleTree } from './studio';

// Server-only helpers for the Module Studio poll lifecycle. A poll block becomes
// a real, votable Poll record (kind 'module') the moment its module is
// published; the record carries a `closesAt` derived from the block's timer.

// Materialize Poll records for any poll blocks that don't have one yet (or whose
// linked poll was deleted). Mutates the tree in place, writing the new pollId
// back into each block's settings. Returns true if anything changed.
export async function materializeModulePolls(tree: ModuleTree): Promise<boolean> {
  let changed = false;
  for (const b of tree.children) {
    if (b.type !== 'poll') continue;
    const linked = typeof b.settings.pollId === 'string' ? b.settings.pollId : null;
    if (linked) {
      const found = await prisma.poll.findUnique({ where: { id: linked }, select: { id: true } });
      if (found) continue; // already materialized
    }
    const question = String(b.settings.question || 'Reader poll').trim() || 'Reader poll';
    const options = (Array.isArray(b.settings.options) ? (b.settings.options as unknown[]) : [])
      .map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) continue; // needs at least two real options to run
    const hours = Number(b.settings.timerHours) || 72;
    const closesAt = new Date(Date.now() + hours * 3600 * 1000);
    const poll = await prisma.poll.create({
      data: { question, kind: 'module', active: true, closesAt, options: { create: options.map((label, i) => ({ label, order: i })) } },
    });
    b.settings.pollId = poll.id;
    changed = true;
  }
  return changed;
}

// Close module polls whose timer has elapsed: deactivate them (hides them from
// their module and stops voting) and record an admin-log entry. They remain in
// the polls archive. Lazy sweep — safe to call on any render. Returns the count.
// Quiz lifecycle parity: close (active=false) any quiz whose timer elapsed, and
// log it — so the Pop Quiz archive shows accurate Live/Closed state like polls.
export async function sweepExpiredQuizzes(): Promise<number> {
  const now = new Date();
  const expired = await prisma.quiz.findMany({
    where: { active: true, closesAt: { lt: now } },
    select: { id: true, title: true },
  });
  if (!expired.length) return 0;
  await prisma.quiz.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { active: false } });
  await prisma.adminLog.createMany({
    data: expired.map((e) => ({ kind: 'quiz_closed', message: `Quiz timer ended — closed & archived: “${e.title}”` })),
  });
  return expired.length;
}

export async function sweepExpiredModulePolls(): Promise<number> {
  const now = new Date();
  const expired = await prisma.poll.findMany({
    where: { kind: 'module', active: true, closesAt: { lt: now } },
    select: { id: true, question: true },
  });
  if (!expired.length) return 0;
  await prisma.poll.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { active: false } });
  await prisma.adminLog.createMany({
    data: expired.map((e) => ({ kind: 'poll_closed', message: `Poll timer ended — closed & archived: “${e.question}”` })),
  });
  return expired.length;
}

// Invisible module expiry: unpublish any custom module whose timer elapsed and
// log it. The public homepage requires `published: true` to render a custom
// module, so unpublishing removes it from the page immediately — we deliberately
// do NOT rewrite the live-layout array here. That read-modify-write ran on every
// public render and could lose-update a concurrent admin Go Live / reorder,
// silently dropping a just-published module. The stale `custom:<id>` entry that
// remains in the layout array is inert (filtered out by the published check), and
// deleteCustomModule still prunes both live and draft arrays on real deletion.
// Lazy sweep — safe to call on any render. Returns the count expired.
export async function sweepExpiredModules(): Promise<number> {
  const now = new Date();
  const expired = await prisma.customModule.findMany({
    where: { published: true, expiresAt: { lt: now } },
    select: { id: true, name: true },
  });
  if (!expired.length) return 0;
  await prisma.customModule.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { published: false, expiresAt: null } });
  await prisma.adminLog.createMany({
    data: expired.map((e) => ({ kind: 'module_expired', message: `Module timer ended — removed from homepage: “${e.name}”` })),
  });
  return expired.length;
}

// Run all three studio expiry sweeps, throttled so a burst of concurrent public
// renders doesn't each re-run them (which duplicated the "timer ended" admin-log
// entries). Claims the throttle window BEFORE sweeping to narrow the race, and
// never throws — a sweep must not break the homepage render. Poll/quiz timers are
// coarse (hours), so a ~1-minute detection lag is immaterial.
const SWEEP_KEY = 'studio_sweep_last_run';
const SWEEP_THROTTLE_MS = 60_000;
export async function sweepStudioExpiries(): Promise<void> {
  try {
    const last = await prisma.setting.findUnique({ where: { key: SWEEP_KEY } });
    const lastMs = last ? Date.parse(last.value) : NaN;
    if (Number.isFinite(lastMs) && Date.now() - lastMs < SWEEP_THROTTLE_MS) return;
    await prisma.setting.upsert({ where: { key: SWEEP_KEY }, update: { value: new Date().toISOString() }, create: { key: SWEEP_KEY, value: new Date().toISOString() } });
    await sweepExpiredModulePolls();
    await sweepExpiredQuizzes();
    await sweepExpiredModules();
  } catch { /* never break the render on a sweep failure */ }
}
