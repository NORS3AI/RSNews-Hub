import type { CategoryPageData } from './categoryData';
import { isPartnerContent } from '@/components/ArticleBadges';

// ─────────────────────────────────────────────────────────────────────────────
// The render manifest — a UI-agnostic, JSON-safe description of a page.
//
// A `getXData()` bundle is the DATA; a manifest is that data flattened into a
// declarative list of typed blocks that say WHAT to show, with no React, no
// styling, and no framework. Any renderer can draw it: the reference
// <ManifestView> in this repo, a native mobile app, or an AI that composes a
// bespoke layout per reader. This is the reader-side analogue of the Module
// Studio composition tree — the concrete proof that the Interface layer is
// swappable without touching Information or Logic (see ARCHITECTURE.md, Phase 4).
//
// Contract: a manifest MUST be JSON-serializable (no Maps, Dates-as-objects,
// class instances, or functions) so it can cross a network/process boundary.
// ─────────────────────────────────────────────────────────────────────────────

export type ManifestBlock =
  | { type: 'heading'; level: 1 | 2; text: string; color?: string }
  | { type: 'text'; text: string; tone?: 'muted' }
  | {
      type: 'article-card';
      id: string;
      title: string;
      href: string;
      excerpt: string | null;
      coverImage: string | null;
      category: { name: string; color: string } | null;
      // Derived FTC disclosure, carried straight from the shared rule so a
      // manifest-driven UI discloses paid content exactly like the React one.
      partner: boolean;
    }
  | { type: 'empty'; text: string };

export type ViewManifest = {
  surface: string;
  title: string;
  blocks: ManifestBlock[];
};

/** Category listing → manifest. Pure: bundle in, JSON-safe manifest out. */
export function categoryManifest(data: CategoryPageData): ViewManifest {
  const blocks: ManifestBlock[] = [
    { type: 'heading', level: 1, text: data.category.name, color: data.category.color },
  ];
  if (data.category.description) {
    blocks.push({ type: 'text', text: data.category.description, tone: 'muted' });
  }
  if (data.articles.length === 0) {
    blocks.push({ type: 'empty', text: 'No articles in this category yet.' });
  } else {
    for (const a of data.articles) {
      blocks.push({
        type: 'article-card',
        id: a.id,
        title: a.title,
        href: `/docs/article/${a.slug}`,
        excerpt: a.excerpt,
        coverImage: a.coverImage,
        category: a.category ? { name: a.category.name, color: a.category.color } : null,
        partner: isPartnerContent(a),
      });
    }
  }
  return { surface: 'category', title: data.category.name, blocks };
}
