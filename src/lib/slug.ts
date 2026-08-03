/** Turn arbitrary text into a URL-friendly slug. */
export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Ensure a slug is unique by appending -2, -3, ... using the provided lookup. */
export function uniqueSlug(base: string, exists: (slug: string) => boolean): string {
  const root = slugify(base) || 'item';
  let candidate = root;
  let n = 2;
  while (exists(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}
