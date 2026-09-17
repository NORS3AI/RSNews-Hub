import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <div className="text-6xl font-bold text-brand-600">404</div>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-[var(--muted)]">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <Link href="/docs" className="btn-primary mt-6">Back to RS News Hub</Link>
      </div>
    </div>
  );
}
