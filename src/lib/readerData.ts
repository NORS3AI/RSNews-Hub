// ─────────────────────────────────────────────────────────────────────────────
// The reader Information layer — one entry point.
//
// Every reader route's data function (`getXData`) and its typed contract,
// re-exported from a single module. An alternate frontend — a native app, a
// redesign, or an AI that composes a per-user layout — imports what it needs from
// here and renders however it likes, without knowing the internal file layout or
// touching a single query. This is the seam that makes the Interface layer
// swappable (see ARCHITECTURE.md). The concrete pages in src/app/(site) are just
// one consumer of these bundles.
//
// Keep this barrel in sync when adding a reader route: add its getXData() + type.
// ─────────────────────────────────────────────────────────────────────────────

// The shared article-card DTO every list/grid/feed renders.
export { cardSelect, toCard, type ArticleCard } from './cards';

// Homepage — the flagship: whole-page state as one typed bundle.
export { getHomepageData, type HomepageData } from './homepageData';

// Category + tag listings, and the categories index.
export {
  getCategoryData, getCategoryMeta, getCategoriesData,
  type CategoryPageData, type CategoriesData,
} from './categoryData';
export { getTagData, getTagMeta, type TagPageData } from './tagData';

// The article reader — a discriminated result: notFound | locked | full.
export { getArticlePageData, getArticleMeta, type ArticlePageFull } from './articleData';

// Archive index + its sub-archives (industry / comics / quizzes / polls).
export {
  getArchiveData, getIndustryArchiveData, getComicsArchiveData, getQuizzesArchiveData, getPollsArchiveData,
  type ArchivePageData, type IndustryArchiveData, type ComicsArchiveData, type QuizzesArchiveData, type PollsArchiveData,
} from './archiveData';

// Search.
export { getSearchData, type SearchPageData } from './searchData';

// CMS static pages (privacy / terms / about / …).
export { getStaticPageData, getStaticPageMeta, type StaticPageData } from './staticPageData';

// Signed-in reader surfaces.
export { getAccountData, type AccountPageData } from './accountData';
export { getVendorDashboardData, type VendorDashboardFull } from './vendorData';
