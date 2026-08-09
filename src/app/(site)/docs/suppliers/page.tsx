import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getPhoneBook, listPremiumSuppliers } from '@/lib/suppliers';
import PhoneBook from '@/components/site/PhoneBook';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suppliers' };

export default async function SuppliersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-page py-8 sm:py-10">
        <div className="module max-w-lg">
          <h1 className="mb-2 text-xl font-bold">Suppliers</h1>
          <p className="text-sm text-[var(--muted)]">
            Sign in to browse our premium supplier directory and keep a personal Phone Book —
            star the suppliers you work with, add your own notes, and save an alternate contact.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/login" className="btn-primary btn-sm">Sign in</Link>
            <Link href="/register" className="btn-outline btn-sm">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  const [entries, directory] = await Promise.all([
    getPhoneBook(user.id),
    listPremiumSuppliers(),
  ]);

  return (
    <div className="container-page py-8 sm:py-10">
      <PhoneBook entries={entries} directory={directory} />
    </div>
  );
}
