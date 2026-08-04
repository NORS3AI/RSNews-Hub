import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Records a vote for an option and returns the updated tallies (live results).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let optionId = '';
  try { optionId = (await req.json())?.optionId || ''; } catch {}
  const option = await prisma.pollOption.findFirst({ where: { id: optionId, pollId: params.id } });
  if (!option) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });

  const poll = await prisma.poll.findUnique({ where: { id: params.id }, select: { active: true, closesAt: true } });
  if (!poll || !poll.active || (poll.closesAt && poll.closesAt < new Date())) {
    return NextResponse.json({ error: 'Poll closed' }, { status: 403 });
  }

  await prisma.pollOption.update({ where: { id: optionId }, data: { votes: { increment: 1 } } });
  const options = await prisma.pollOption.findMany({ where: { pollId: params.id }, orderBy: { order: 'asc' }, select: { id: true, label: true, votes: true } });
  return NextResponse.json({ options, total: options.reduce((n, o) => n + o.votes, 0) });
}
