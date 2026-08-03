import Link from 'next/link';
import type { Metadata } from 'next';
import { listPages } from '@/lib/pages';

export const metadata: Metadata = {
  title: 'Docs',
  description: 'How RSNews Hub works, and how to embed it into the main website.',
};
export const dynamic = 'force-dynamic';

export default function DocsPage() {
  const pages = listPages('published');

  return (
    <div className="container-rs py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black text-slate-900">RSNews Hub — Docs</h1>
        <p className="mt-2 text-slate-500">
          Everything you need to read, subscribe, and (for staff) publish content.
        </p>

        <div className="prose prose-slate mt-8 max-w-none">
          <h2>Reading</h2>
          <ul>
            <li>
              The <Link href="/main">home page</Link> shows the latest and featured stories plus your
              personalised recommendations when signed in.
            </li>
            <li>
              Open any article to read it, then use <strong>Read next →</strong> to keep going. The
              “If you read this, you might like” section suggests related stories from shared tags and
              category.
            </li>
            <li>
              Use <Link href="/search">Search</Link> for full-text search, and the{' '}
              <Link href="/archive">Archive</Link> to browse everything by month.
            </li>
          </ul>

          <h2>Accounts &amp; subscriptions</h2>
          <ul>
            <li>
              Create an account to <strong>subscribe</strong> to articles and categories and to unlock
              recommendations that learn from your reading history.
            </li>
            <li>
              Your <Link href="/dashboard">dashboard</Link> lists your subscriptions, reading history
              and fresh suggestions.
            </li>
          </ul>

          <h2>For staff (admin &amp; editors)</h2>
          <ul>
            <li>
              The <Link href="/admin">admin dashboard</Link> is where you create, edit, publish,
              archive and trash articles and pages, and manage categories and tags.
            </li>
            <li>
              Admins also have a lightweight <strong>CRM</strong> to add, edit, move (change roles),
              suspend and ban users.
            </li>
          </ul>

          <h2>Embedding into the main website</h2>
          <p>
            RSNews Hub is a self-contained app with clean routes such as <code>/main</code> and{' '}
            <code>/docs</code>. To embed it into the marketing site you can either reverse-proxy these
            paths, or drop in an iframe:
          </p>
          <pre>
            <code>{`<iframe
  src="https://hub.example.com/main"
  style="width:100%;height:100vh;border:0"
  title="RSNews Hub"
></iframe>`}</code>
          </pre>
          <p>
            The layout is fully responsive, so the same embed works on mobile, tablet and desktop.
          </p>

          {pages.length > 0 && (
            <>
              <h2>More pages</h2>
              <ul>
                {pages.map((p) => (
                  <li key={p.id}>
                    <Link href={`/p/${p.slug}`}>{p.title}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
