import type { Metadata } from 'next';
import AdminSidebar from '@/components/AdminSidebar';
import { requireStaff } from '@/lib/guards';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 md:flex-row">
      <AdminSidebar user={user} />
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
