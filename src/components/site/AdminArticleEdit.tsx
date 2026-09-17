'use client';
import { createContext, useContext } from 'react';
import Link from 'next/link';
import { Edit } from '@/components/icons';

// Whether the current viewer is staff — provided once at the top of the homepage
// so every article element below can show an edit affordance without threading a
// prop through a dozen call sites. Defaults false, so ArticleCard used elsewhere
// (search, category pages…) stays clean unless a provider opts in.
const AdminEditContext = createContext(false);
export function AdminEditProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <AdminEditContext.Provider value={value}>{children}</AdminEditContext.Provider>;
}

// Admin-only edit pencil for one article element. Renders nothing unless an
// AdminEditProvider above marks the viewer as staff. Place inside a
// `group relative` parent (as a sibling of the element's link, NOT nested in it,
// to avoid an <a> inside an <a>). Sits top-left so it clears the top-right star.
export default function AdminArticleEdit({ id, pos = 'left-2 top-2' }: { id: string; pos?: string }) {
  const on = useContext(AdminEditContext);
  if (!on) return null;
  return (
    <Link href={`/admin/articles/${id}`} title="Edit this article" aria-label="Edit this article"
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${pos} z-20 inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-bold text-[var(--fg)] opacity-0 shadow-card transition hover:border-brand-400 hover:text-brand-600 focus:opacity-100 group-hover:opacity-100`}>
      <Edit width={13} height={13} /> Edit
    </Link>
  );
}
