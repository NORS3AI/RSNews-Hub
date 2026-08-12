import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { parseJson } from '@/lib/http';
import {
  topicMenu, getAccountTopics, setAccountTopics,
  getAccountEmails, upsertDigestEmail, removeDigestEmail, parseTopics,
} from '@/lib/subscriptions';
import { isNewsletterEnabled } from '@/lib/newsletter';

// Current subscription state for the popup: the topic menu, the account-wide
// notification topics, and the digest emails this account has added.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const [menu, notifyTopics, emails, emailDigestEnabled] = await Promise.all([
    topicMenu(), getAccountTopics(user.id), getAccountEmails(user.id), isNewsletterEnabled(),
  ]);
  return NextResponse.json({
    menu, notifyTopics,
    emails: emails.map((e) => ({ id: e.id, email: e.email, topics: parseTopics(e.topics) })),
    accountEmail: user.email,
    emailDigestEnabled,
  });
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('notify'), topics: z.array(z.string()).max(50) }),
  z.object({ action: z.literal('email'), email: z.string().min(3).max(200), topics: z.array(z.string()).max(50) }),
  z.object({ action: z.literal('removeEmail'), id: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to subscribe.' }, { status: 401 });
  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  if (d.action === 'notify') {
    await setAccountTopics(user.id, d.topics);
    return NextResponse.json({ ok: true });
  }
  if (d.action === 'email') {
    // Don't accept new digest signups while the feature is turned off.
    if (!(await isNewsletterEnabled())) return NextResponse.json({ error: 'The email digest is currently paused.' }, { status: 403 });
    const r = await upsertDigestEmail(user.id, d.email, d.topics);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  // removeEmail
  const r = await removeDigestEmail(user.id, d.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
