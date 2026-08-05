import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Records a vote for an option and returns the updated tallies (live results).
// Requires a logged-in account and allows one vote per user per poll (enforced
// by the PollVote unique constraint).
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const parsed = await parseJson(req, z.object({ optionId: z.string().min(1) }));
  if (!parsed.ok) return parsed.res;
  const { optionId } = parsed.data;
  const option = await prisma.pollOption.findFirst({ where: { id: optionId, pollId: params.id } });
  if (!option) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });

  const poll = await prisma.poll.findUnique({ where: { id: params.id }, select: { active: true, closesAt: true } });
  if (!poll || !poll.active || (poll.closesAt && poll.closesAt < new Date())) {
    return NextResponse.json({ error: 'Poll closed' }, { status: 403 });
  }

  // One vote per account. Reserve the slot first so a duplicate (or a race) is
  // rejected by the unique constraint before we increment the tally.
  try {
    await prisma.pollVote.create({ data: { pollId: params.id, userId: user.id, optionId } });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already voted' }, { status: 409 });
    }
    throw e;
  }

  await prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } });
  const options = await prisma.pollOption.findMany({ where: { pollId: params.id }, orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } });
  return NextResponse.json({ options, total: options.reduce((n, o) => n + o.votes, 0) });
}
