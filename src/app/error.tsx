'use client';
import Link from 'next/link';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-[var(--muted)]">An unexpected error occurred.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/docs" className="btn-outline">Go home</Link>
        </div>
      </div>
    </div>
  );
}
