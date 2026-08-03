import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { getCurrentUser } from '@/lib/auth';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
