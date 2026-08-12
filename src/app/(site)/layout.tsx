import SiteProviders from '@/components/site/SiteProviders';
import AppSidebarShell from '@/components/site/AppSidebarShell';
import ConsentBanner from '@/components/site/ConsentBanner';
import { AdPreviewBanner } from '@/components/site/AdPreview';
import ViewAsBar from '@/components/site/ViewAsBar';
import { getCurrentUser } from '@/lib/auth';
import { canViewAs, activeViewAs } from '@/lib/viewAsServer';
import { listAdvertisers } from '@/lib/adsServer';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Admin "View as": offer the switcher (and reflect the active impersonation)
  // only to real staff/admin accounts.
  const showViewAs = canViewAs(user);
  const [vendorBrands, viewingAs] = showViewAs
    ? await Promise.all([listAdvertisers().then((a) => a.map((x) => x.brand)), activeViewAs(user)])
    : [[], null];
  return (
    <SiteProviders>
      <AppSidebarShell user={user ? { id: user.id, name: user.name, role: user.role } : null}>
        {children}
      </AppSidebarShell>
      <ConsentBanner />
      <AdPreviewBanner />
      {showViewAs && <ViewAsBar vendorBrands={vendorBrands} active={viewingAs?.label ?? ''} />}
    </SiteProviders>
  );
}
