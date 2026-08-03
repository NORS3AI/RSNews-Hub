import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import AdminShell from '@/components/AdminShell';

export const metadata = { title: 'Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect('/login?next=/admin');
  return <AdminShell user={{ name: user.name, role: user.role }}>{children}</AdminShell>;
}
