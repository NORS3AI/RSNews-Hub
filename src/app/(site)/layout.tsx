import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import SiteProviders from '@/components/site/SiteProviders';
import StarStrip from '@/components/site/StarStrip';
import { getCurrentUser } from '@/lib/auth';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <SiteProviders>
      <div className="flex min-h-screen flex-col">
        {/* Header + starred strip pin to the top together as one cluster. */}
        <div className="sticky top-0 z-40">
          <SiteHeader user={user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null} />
          <StarStrip />
        </div>
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </SiteProviders>
  );
}
