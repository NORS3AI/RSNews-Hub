import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { envReport } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Liveness + readiness probe for the host (and a quick config sanity check).
// GET /api/health → 200 when the DB answers, 503 when it doesn't.
export async function GET() {
  const config = envReport();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', service: 'rsnews-hub', db: 'up', config, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'degraded', service: 'rsnews-hub', db: 'down', config }, { status: 503 });
  }
}
