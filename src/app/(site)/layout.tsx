import SiteProviders from '@/components/site/SiteProviders';
import AppSidebarShell from '@/components/site/AppSidebarShell';
import ConsentBanner from '@/components/site/ConsentBanner';
import { AdPreviewBanner } from '@/components/site/AdPreview';
import ViewAsBar from '@/components/site/ViewAsBar';
import AnnouncementBar from '@/components/site/AnnouncementBar';
import { getCurrentUser } from '@/lib/auth';
import { isActiveVendor } from '@/lib/vendors';
import { canViewAs, activeViewAs } from '@/lib/viewAsServer';
import { listAdvertisers } from '@/lib/adsServer';
import { getLiveAnnouncement, announcementSignature } from '@/lib/announcement';
import { getGenreMap } from '@/lib/genreServer';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Live genre map (slug → label/color) for the whole site's genre badges.
  const genres = await getGenreMap();
  // Gate the top bar by the viewer's entitlement: a PackageHub-only message is
  // filtered out server-side for everyone else (never sent to their browser).
  const liveAnnouncement = await getLiveAnnouncement(user);
  // Admin "View as": offer the switcher (and reflect the active impersonation)
  // only to real staff/admin accounts.
  const showViewAs = canViewAs(user);
  const [vendorBrands, viewingAs] = showViewAs
    ? await Promise.all([listAdvertisers().then((a) => a.map((x) => x.brand)), activeViewAs(user)])
    : [[], null];
  return (
    <SiteProviders genres={genres}>
      <AppSidebarShell
        user={user ? { id: user.id, name: user.name, role: user.role } : null}
        isVendor={await isActiveVendor(user)}
        announcement={liveAnnouncement
          ? <AnnouncementBar record={liveAnnouncement} sig={announcementSignature(liveAnnouncement)} />
          : null}>
        {children}
      </AppSidebarShell>
      <ConsentBanner />
      <AdPreviewBanner />
      {showViewAs && <ViewAsBar vendorBrands={vendorBrands} active={viewingAs?.label ?? ''} />}
    </SiteProviders>
  );
}
