import SiteProviders from '@/components/site/SiteProviders';
import AppSidebarShell from '@/components/site/AppSidebarShell';
import ConsentBanner from '@/components/site/ConsentBanner';
import { AdPreviewBanner } from '@/components/site/AdPreview';
import ViewAsBar from '@/components/site/ViewAsBar';
import AnnouncementBar from '@/components/site/AnnouncementBar';
import { getCurrentUser } from '@/lib/auth';
import { canViewAs, activeViewAs } from '@/lib/viewAsServer';
import { listAdvertisers } from '@/lib/adsServer';
import { getAnnouncement, announcementSignature } from '@/lib/announcement';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const announcement = await getAnnouncement();
  // Admin "View as": offer the switcher (and reflect the active impersonation)
  // only to real staff/admin accounts.
  const showViewAs = canViewAs(user);
  const [vendorBrands, viewingAs] = showViewAs
    ? await Promise.all([listAdvertisers().then((a) => a.map((x) => x.brand)), activeViewAs(user)])
    : [[], null];
  return (
    <SiteProviders>
      <AppSidebarShell
        user={user ? { id: user.id, name: user.name, role: user.role } : null}
        announcement={announcement.enabled && announcement.message
          ? <AnnouncementBar config={announcement} sig={announcementSignature(announcement)} />
          : null}>
        {children}
      </AppSidebarShell>
      <ConsentBanner />
      <AdPreviewBanner />
      {showViewAs && <ViewAsBar vendorBrands={vendorBrands} active={viewingAs?.label ?? ''} />}
    </SiteProviders>
  );
}
