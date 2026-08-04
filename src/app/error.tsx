'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/logger';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { captureError(error, { boundary: 'route', digest: error.digest }); }, [error]);
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-[var(--muted)]">An unexpected error occurred — we&apos;ve logged it.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/docs" className="btn-outline">Go home</Link>
        </div>
      </div>
    </div>
  );
}
