import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ARCHITECTURE GUARD (see ARCHITECTURE.md, rule 1).
//
// The Interface layer — the reader pages under src/app/(site) — must render from
// typed getXData() bundles and never reach into the database itself. All DB
// access lives one layer down, in the Information layer (src/lib/*Data.ts). This
// test fails the build if a reader page imports the Prisma client directly, so
// the data/view separation that makes the UI swappable can't silently erode.
//
// If this test fails: move the query into (or add) a getXData() function in
// src/lib/*Data.ts and have the page consume its return value.

const READER_ROOT = join(process.cwd(), 'src/app/(site)');

function pageModules(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageModules(full));
    // page.tsx and layout.tsx are the render entry points — the Interface layer.
    else if (entry.name === 'page.tsx' || entry.name === 'layout.tsx') out.push(full);
  }
  return out;
}

const rel = (f: string) => f.slice(process.cwd().length + 1);

describe('architecture boundary — reader Interface layer is Prisma-free', () => {
  const files = pageModules(READER_ROOT);

  it('discovers reader page modules to guard', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [rel(f), f] as const))('%s does not import the DB client', (_label, file) => {
    const src = readFileSync(file, 'utf8');
    // The db client (`@/lib/db`) and the raw Prisma package are the two ways a
    // page could reach the database directly. A page that needs data must import
    // a getXData() function from src/lib/*Data.ts instead.
    expect(src, `${_label} imports @/lib/db — route this through a getXData() function (ARCHITECTURE.md)`).not.toMatch(/from ['"]@\/lib\/db['"]/);
    expect(src, `${_label} imports @prisma/client directly — use a getXData() function (ARCHITECTURE.md)`).not.toMatch(/from ['"]@prisma\/client['"]/);
  });
});
