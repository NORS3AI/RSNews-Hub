import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSessionUser, prisma } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  prisma: {
    quiz: { findUnique: vi.fn(), update: vi.fn() },
    quizResponse: { create: vi.fn() },
    quizOption: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/auth', () => ({ getSessionUser }));
vi.mock('@/lib/db', () => ({ prisma }));

import { POST } from './route';

const params = { params: Promise.resolve({ id: 'quiz1' }) };
const makeReq = (body: unknown) =>
  new Request('http://t/api/quizzes/quiz1/submit', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const openQuiz = {
  active: true,
  closesAt: new Date(Date.now() + 3600_000),
  questions: [{ id: 'q1', options: [{ id: 'o1' }, { id: 'o2' }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', role: 'USER', status: 'ACTIVE' });
  prisma.quiz.findUnique.mockResolvedValue(openQuiz);
  prisma.quizResponse.create.mockResolvedValue({ id: 'r1' });
  prisma.$transaction.mockResolvedValue([]);
});

describe('POST /api/quizzes/[id]/submit', () => {
  it('rejects anonymous users with 401', async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(makeReq({ answers: { q1: 'o1' } }), params);
    expect(res.status).toBe(401);
    expect(prisma.quizResponse.create).not.toHaveBeenCalled();
  });

  it('rejects a closed quiz with 403', async () => {
    prisma.quiz.findUnique.mockResolvedValue({ ...openQuiz, closesAt: new Date(Date.now() - 1000) });
    const res = await POST(makeReq({ answers: { q1: 'o1' } }), params);
    expect(res.status).toBe(403);
  });

  it('rejects a submission with no valid answers with 400', async () => {
    const res = await POST(makeReq({ answers: { q1: 'nope' } }), params);
    expect(res.status).toBe(400);
  });

  it('records a valid submission tied to the account and returns ok', async () => {
    const res = await POST(makeReq({ answers: { q1: 'o1' } }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.quizResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quizId: 'quiz1', userId: 'u1' }) }),
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects a second submission from the same account with 409', async () => {
    prisma.quizResponse.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const res = await POST(makeReq({ answers: { q1: 'o1' } }), params);
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
