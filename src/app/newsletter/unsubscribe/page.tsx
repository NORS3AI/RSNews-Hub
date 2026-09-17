import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unsubscribeByToken } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe' };

const wrap: React.CSSProperties = { maxWidth: 460, margin: '0 auto', padding: '64px 24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' };
const brand = { color: '#E97D34', fontWeight: 800, fontSize: 20, marginBottom: 18 } as const;

// Deactivate only on an explicit POST (the confirm button). A plain GET must NOT
// mutate — email link scanners (Outlook SafeLinks, Proofpoint, corporate AV) and
// browser prefetchers fetch links in received mail, and a GET-side-effect would
// unsubscribe people who never clicked.
async function confirmUnsubscribe(formData: FormData) {
  'use server';
  const token = String(formData.get('token') || '');
  const res = token ? await unsubscribeByToken(token) : { ok: false as boolean };
  redirect(`/newsletter/unsubscribe?done=${res.ok ? '1' : '0'}`);
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;

  // Result screen (after the POST).
  if (done != null) {
    const ok = done === '1';
    return (
      <div style={wrap}>
        <div style={brand}>RS News Hub</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{ok ? "You're unsubscribed" : 'Link not recognized'}</h1>
        <p style={{ color: '#6b7280' }}>
          {ok
            ? "That address won't receive the Industry News digest anymore. You can re-subscribe any time from the homepage."
            : 'That unsubscribe link is invalid or already used.'}
        </p>
        <p style={{ marginTop: 24 }}><Link href="/docs" style={{ color: '#E97D34', fontWeight: 700 }}>← Back to RS News Hub</Link></p>
      </div>
    );
  }

  // Confirm screen (GET). No token → nothing to do.
  return (
    <div style={wrap}>
      <div style={brand}>RS News Hub</div>
      {token ? (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Unsubscribe from the digest?</h1>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>Confirm and you&apos;ll stop receiving the Industry News digest. You can re-subscribe any time.</p>
          <form action={confirmUnsubscribe}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" style={{ background: '#E97D34', color: '#fff', fontWeight: 700, border: 0, borderRadius: 10, padding: '12px 22px', fontSize: 15, cursor: 'pointer' }}>
              Confirm unsubscribe
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Link not recognized</h1>
          <p style={{ color: '#6b7280' }}>That unsubscribe link is invalid.</p>
        </>
      )}
      <p style={{ marginTop: 24 }}><Link href="/docs" style={{ color: '#E97D34', fontWeight: 700 }}>← Back to RS News Hub</Link></p>
    </div>
  );
}
