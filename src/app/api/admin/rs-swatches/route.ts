import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const KEY = 'rs_swatches';
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX = 24;

async function read(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return [];
  try { const a = JSON.parse(row.value); return Array.isArray(a) ? a.filter((s) => typeof s === 'string' && HEX.test(s)) : []; }
  catch { return []; }
}
async function write(list: string[]) {
  const value = JSON.stringify(list.slice(0, MAX));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ swatches: await read() });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { hex } = await req.json().catch(() => ({}));
  if (typeof hex !== 'string' || !HEX.test(hex)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const list = await read();
  if (!list.includes(hex)) list.unshift(hex);
  await write(list);
  return NextResponse.json({ swatches: list.slice(0, MAX) });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { hex } = await req.json().catch(() => ({}));
  const list = (await read()).filter((s) => s !== hex);
  await write(list);
  return NextResponse.json({ swatches: list });
}
