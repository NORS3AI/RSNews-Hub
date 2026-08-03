import Link from 'next/link';
import PageForm from '@/components/admin/PageForm';
import { createPageAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default function NewPagePage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/pages" className="text-sm text-slate-500 hover:text-slate-900">
          ← Pages
        </Link>
        <h1 className="mt-1 text-2xl font-black text-slate-900">New page</h1>
      </div>
      <PageForm action={createPageAction} />
    </div>
  );
}
