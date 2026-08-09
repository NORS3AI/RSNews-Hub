import { prisma } from './db';
import type { ModuleTree } from './studio';
import { getHomeLayout, saveHomeLayout } from './homepage';

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

// Invisible module expiry: pull any published custom module whose timer elapsed
// off the homepage (unpublish + remove from the live layout) and log it. Lazy
// sweep — safe to call on any render. Returns the count removed.
export async function sweepExpiredModules(): Promise<number> {
  const now = new Date();
  const expired = await prisma.customModule.findMany({
    where: { published: true, expiresAt: { lt: now } },
    select: { id: true, name: true },
  });
  if (!expired.length) return 0;
  const ids = expired.map((e) => e.id);
  await prisma.customModule.updateMany({ where: { id: { in: ids } }, data: { published: false, expiresAt: null } });
  const remove = new Set(ids.map((id) => `custom:${id}`));
  const layout = await getHomeLayout();
  const pruned = layout.filter((m) => !remove.has(m.id));
  if (pruned.length !== layout.length) await saveHomeLayout(pruned);
  await prisma.adminLog.createMany({
    data: expired.map((e) => ({ kind: 'module_expired', message: `Module timer ended — removed from homepage: “${e.name}”` })),
  });
  return expired.length;
}
