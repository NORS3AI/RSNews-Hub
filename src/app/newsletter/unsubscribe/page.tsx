import Link from 'next/link';
import { unsubscribeByToken } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribed' };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const res = token ? await unsubscribeByToken(token) : { ok: false as boolean, email: undefined as string | undefined };

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '64px 24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#E97D34', fontWeight: 800, fontSize: 20, marginBottom: 18 }}>RS News Hub</div>
      {res.ok ? (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>You&apos;re unsubscribed</h1>
          <p style={{ color: '#6b7280' }}>{res.email ? res.email : 'That address'} won&apos;t receive the Industry News digest anymore. You can re-subscribe any time from the homepage.</p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Link not recognized</h1>
          <p style={{ color: '#6b7280' }}>That unsubscribe link is invalid or already used.</p>
        </>
      )}
      <p style={{ marginTop: 24 }}><Link href="/docs" style={{ color: '#E97D34', fontWeight: 700 }}>← Back to RS News Hub</Link></p>
    </div>
  );
}
