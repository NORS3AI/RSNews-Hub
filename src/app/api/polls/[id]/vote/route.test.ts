import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSessionUser, prisma } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  prisma: {
    poll: { findUnique: vi.fn() },
    pollOption: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    pollVote: { create: vi.fn() },
  },
}));
vi.mock('@/lib/auth', () => ({ getSessionUser }));
vi.mock('@/lib/db', () => ({ prisma }));

import { POST } from './route';

const params = { params: Promise.resolve({ id: 'poll1' }) };
const makeReq = (body: unknown) =>
  new Request('http://t/api/polls/poll1/vote', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: 'USER', status: 'ACTIVE' });
  prisma.pollOption.findFirst.mockResolvedValue({ id: 'o1', pollId: 'poll1' });
  prisma.poll.findUnique.mockResolvedValue({ active: true, closesAt: null });
  prisma.pollVote.create.mockResolvedValue({ id: 'v1' });
  prisma.pollOption.update.mockResolvedValue({});
  prisma.pollOption.findMany.mockResolvedValue([
    { id: 'o1', label: 'A', votes: 3 },
    { id: 'o2', label: 'B', votes: 1 },
  ]);
});

describe('POST /api/polls/[id]/vote', () => {
  it('rejects anonymous users with 401', async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(makeReq({ optionId: 'o1' }), params);
    expect(res.status).toBe(401);
    expect(prisma.pollVote.create).not.toHaveBeenCalled();
  });

  it('rejects an option that is not part of the poll with 400', async () => {
    prisma.pollOption.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ optionId: 'ghost' }), params);
    expect(res.status).toBe(400);
  });

  it('rejects a closed poll with 403', async () => {
    prisma.poll.findUnique.mockResolvedValue({ active: true, closesAt: new Date(Date.now() - 1000) });
    const res = await POST(makeReq({ optionId: 'o1' }), params);
    expect(res.status).toBe(403);
  });

  it('records a vote tied to the account and returns updated tallies', async () => {
    const res = await POST(makeReq({ optionId: 'o1' }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(4);
    expect(prisma.pollVote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pollId: 'poll1', userId: 'u1', optionId: 'o1' }) }),
    );
    expect(prisma.pollOption.update).toHaveBeenCalledOnce();
  });

  it('rejects a second vote from the same account with 409', async () => {
    prisma.pollVote.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const res = await POST(makeReq({ optionId: 'o1' }), params);
    expect(res.status).toBe(409);
    expect(prisma.pollOption.update).not.toHaveBeenCalled();
  });
});
