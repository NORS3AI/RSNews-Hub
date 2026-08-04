'use client';
import { useEffect } from 'react';
import { captureError } from '@/lib/logger';

// Catches errors thrown in the root layout itself. Must render its own
// <html>/<body>. Kept dependency-free (no app CSS is guaranteed here).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { captureError(error, { boundary: 'global', digest: error.digest }); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#141821', color: '#f4f1ea' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginTop: 8 }}>We&apos;ve logged the problem. Please try again.</p>
          <button onClick={reset} style={{ marginTop: 20, padding: '10px 18px', borderRadius: 10, border: 0, background: '#E97D34', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
