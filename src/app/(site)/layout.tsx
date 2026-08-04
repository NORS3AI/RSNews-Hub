import SiteProviders from '@/components/site/SiteProviders';
import AppSidebarShell from '@/components/site/AppSidebarShell';
import { getCurrentUser } from '@/lib/auth';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <SiteProviders>
      <AppSidebarShell user={user ? { id: user.id, name: user.name, role: user.role } : null}>
        {children}
      </AppSidebarShell>
    </SiteProviders>
  );
}
