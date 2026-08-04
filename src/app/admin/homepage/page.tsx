import { getHomeLayout, MODULE_CATALOG } from '@/lib/homepage';
import HomeLayoutEditor from '@/components/admin/HomeLayoutEditor';

export const dynamic = 'force-dynamic';

export default async function AdminHomepage() {
  const layout = await getHomeLayout();
  const modules = layout.map((m) => ({
    id: m.id,
    label: MODULE_CATALOG[m.id].label,
    description: MODULE_CATALOG[m.id].description,
    enabled: m.enabled,
    locked: !!m.locked,
  }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Homepage layout</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Drag to reorder or use the arrows; toggle visibility, and lock a module to freeze it in place. The headline block stays pinned at the top.
      </p>
      <HomeLayoutEditor modules={modules} />
    </div>
  );
}
