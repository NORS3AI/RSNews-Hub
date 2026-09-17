import { prisma } from '@/lib/db';
import BylineManager from '@/components/admin/BylineManager';

export const dynamic = 'force-dynamic';

// Admin: the Byline library — saved authors (photo + name + title) an editor can
// attach to any article. Editing one here updates it on every article that uses
// it. Articles with no byline chosen show the house "RS News Hub Team" default.
export default async function AdminBylines() {
  const list = await prisma.byline.findMany({
    orderBy: [{ archived: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, title: true, photo: true, bio: true, archived: true },
  });
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Bylines</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">
        Saved authors you can attach to any article from its Byline picker — a photo, a name, and a title. Edit one here and it updates on every article that uses it (a new title, a new photo). Articles with no byline show the house <b>RS News Hub Team</b> default, so you never have to set one.
      </p>
      <BylineManager list={list} />
    </div>
  );
}
