import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { envReport } from '@/lib/env';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Liveness + readiness probe for the host. GET /api/health → 200 when the DB
// answers, 503 when it doesn't. The detailed config posture (auth mode, storage/
// email backends, weak-secret flag, …) is only returned to an authenticated
// admin — an anonymous caller gets just liveness, so we don't hand an attacker a
// misconfiguration map.
export async function GET() {
  let db = 'up';
  let ok = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down'; ok = false;
  }
  const body: Record<string, unknown> = { status: ok ? 'ok' : 'degraded', service: 'rsnews-hub', db, time: new Date().toISOString() };

  // Admin-only detail (best-effort — never let an auth hiccup fail the probe).
  try { if (await requireAdmin()) body.config = envReport(); } catch { /* omit config */ }

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
