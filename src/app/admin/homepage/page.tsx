import { getHomeLayout, moduleSource, MODULE_CATALOG, type ModuleId } from '@/lib/homepage';
import { isCustomModuleId, customIdOf } from '@/lib/studio';
import { prisma } from '@/lib/db';
import HomeLayoutEditor from '@/components/admin/HomeLayoutEditor';

export const dynamic = 'force-dynamic';

export default async function AdminHomepage() {
  const layout = await getHomeLayout();

  // Resolve display names for any custom modules referenced in the layout.
  const customIds = layout.map((m) => customIdOf(m.id)).filter((v): v is string => !!v);
  const customs = customIds.length
    ? await prisma.customModule.findMany({ where: { id: { in: customIds } }, select: { id: true, name: true, shape: true, published: true } })
    : [];
  const customById = new Map(customs.map((c) => [c.id, c]));

  const modules = layout.map((m) => {
    if (isCustomModuleId(m.id)) {
      const c = customById.get(customIdOf(m.id)!);
      return {
        id: m.id,
        label: c ? c.name : 'Custom module (deleted)',
        description: c ? `Custom module · ${c.shape}${c.published ? '' : ' · draft'}` : 'This custom module no longer exists — remove it.',
        enabled: m.enabled,
        locked: !!m.locked,
        sources: null,
        source: null,
      };
    }
    const def = MODULE_CATALOG[m.id as ModuleId];
    return {
      id: m.id,
      label: def.label,
      description: def.description,
      enabled: m.enabled,
      locked: !!m.locked,
      sources: def.sources ?? null,
      source: moduleSource(m) ?? null,
    };
  });

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
