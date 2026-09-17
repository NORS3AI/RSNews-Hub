import { smartSearch } from './recommend';

// Information layer for the search page. The ranking/matching lives in the Logic
// layer (smartSearch); this just packages the query + its results for the view.
export async function getSearchData(rawQuery: string | undefined) {
  const q = (rawQuery ?? '').trim();
  const results = q ? await smartSearch(q, 30) : [];
  return { q, results };
}

export type SearchPageData = Awaited<ReturnType<typeof getSearchData>>;
