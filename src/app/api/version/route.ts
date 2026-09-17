import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Tiny public probe so you can confirm which build is actually live: visit
// /api/version. If it returns v0.98.0+ the current code is deployed; a 404 means
// the deploy hasn't reached this site yet.
export function GET() {
  return NextResponse.json({ version: APP_VERSION });
}
