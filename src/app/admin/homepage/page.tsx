import { getDraftLayout, hasDraftChanges, moduleSource, clampSpan, MODULE_CATALOG, type ModuleId } from '@/lib/homepage';
import { isCustomModuleId, customIdOf, parseTree, blockLabel } from '@/lib/studio';
import { prisma } from '@/lib/db';
import HomeLayoutEditor from '@/components/admin/HomeLayoutEditor';
import RsBackgroundControl from '@/components/admin/RsBackgroundControl';
import GoLiveBar from '@/components/admin/GoLiveBar';

export const dynamic = 'force-dynamic';

export default async function AdminHomepage() {
  // Admins edit the DRAFT arrangement; it goes public only via Go Live.
  const [layout, pending] = await Promise.all([getDraftLayout(), hasDraftChanges()]);

  // Resolve display names for any custom modules referenced in the layout.
  const customIds = layout.map((m) => customIdOf(m.id)).filter((v): v is string => !!v);
  const customs = customIds.length
    ? await prisma.customModule.findMany({ where: { id: { in: customIds } }, select: { id: true, name: true, shape: true, published: true, tree: true } })
    : [];
  const customById = new Map(customs.map((c) => [c.id, c]));

  // Elements that are placed in the arrangement but scheduled to appear LATER —
  // so Go Live can reassure the admin their spot is locked in for that date
  // rather than looking like nothing happened.
  const now = Date.now();
  const scheduled: { module: string; label: string; at: string }[] = [];
  for (const m of layout) {
    if (!m.enabled || !isCustomModuleId(m.id)) continue;
    const c = customById.get(customIdOf(m.id)!);
    if (!c) continue;
    for (const b of parseTree(c.tree).children) {
      if (b.startAt && Date.parse(b.startAt) > now) {
        scheduled.push({ module: c.name, label: b.label || blockLabel(b.type), at: b.startAt });
      }
    }
  }
  scheduled.sort((a, b) => a.at.localeCompare(b.at));

  const rsBgSetting = await prisma.setting.findUnique({ where: { key: 'rs_bg_color' } });
  const rsBg = rsBgSetting?.value ?? '';

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
        span: clampSpan(m.span),
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
      span: clampSpan(m.span),
    };
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Homepage layout</h1>
      <p className="mb-6 mt-1 text-[var(--muted)]">
        Drag to reorder or use the arrows; toggle visibility, and lock a module to freeze it in place. Changes are saved as a draft — press <strong>Go Live</strong> to publish them to the public homepage. The headline block stays pinned at the top.
      </p>
      <GoLiveBar pending={pending} scheduled={scheduled} />
      <RsBackgroundControl current={rsBg} />
      <HomeLayoutEditor modules={modules} />
    </div>
  );
}
