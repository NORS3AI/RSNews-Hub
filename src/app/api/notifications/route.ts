import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { unreadCount, markNotificationsSeen } from '@/lib/subscriptions';

// Unread count for the sidebar bell badge.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0 });
  return NextResponse.json({ unread: await unreadCount(user.id) });
}

// Mark the whole account's notifications as seen (called when the inbox opens).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await markNotificationsSeen(user.id);
  return NextResponse.json({ ok: true });
}
