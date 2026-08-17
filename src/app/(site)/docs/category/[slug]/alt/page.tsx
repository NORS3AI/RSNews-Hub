import { notFound } from 'next/navigation';
import { getCategoryData } from '@/lib/categoryData';
import { categoryManifest } from '@/lib/manifest';
import ManifestView from '@/components/site/ManifestView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Category — manifest view' };

// A SECOND category page, rendered from the SAME getCategoryData() bundle — but
// via a UI-agnostic manifest fed to the generic <ManifestView> instead of the
// bespoke React in ../page.tsx. Same data + logic, a different interface, zero
// changes below the Interface layer. Proof that the UI is swappable
// (ARCHITECTURE.md, Phase 4). Visit /docs/category/<slug>/alt to compare.
export default async function CategoryManifestPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const data = await getCategoryData(slug);
  if (!data) notFound();
  return <ManifestView manifest={categoryManifest(data)} />;
}
