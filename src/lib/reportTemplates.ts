// Saved Report-builder templates. A template is just a named, sanitized copy of
// the builder querystring (scope / days / brand / hide / viz). Nothing is
// frozen: pressing a template re-opens the builder with those settings and
// buildReport() recomputes every number live from analytics events, so "press
// one button and get the updated numbers" is automatic.

import { prisma } from './db';
import { parseReportParams, reportQuery } from './reportData';

export type ReportTemplateRecord = {
  id: string;
  name: string;
  query: string;   // normalized builder querystring, e.g. "scope=site&days=90&viz=devices:bar"
  createdAt: string;
};

type Row = { id: string; name: string; query: string; createdAt: Date };
const toRecord = (r: Row): ReportTemplateRecord => ({ id: r.id, name: r.name, query: r.query, createdAt: r.createdAt.toISOString() });

/** Round-trip an arbitrary querystring through the builder's own parser so only
 *  whitelisted, validated params survive (guards against junk/injection in the
 *  stored string). */
export function normalizeQuery(raw: string): string {
  const sp = Object.fromEntries(new URLSearchParams(raw));
  return reportQuery(parseReportParams(sp));
}

/** All saved templates, newest first. */
export async function listReportTemplates(): Promise<ReportTemplateRecord[]> {
  const rows = await prisma.reportTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toRecord);
}

/** Save a new template from the current builder querystring. Returns its id. */
export async function saveReportTemplate(name: string, query: string): Promise<string> {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error('A template needs a name.');
  const row = await prisma.reportTemplate.create({
    data: { name: clean, query: normalizeQuery(query) },
    select: { id: true },
  });
  return row.id;
}

export async function renameReportTemplate(id: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error('A template needs a name.');
  await prisma.reportTemplate.updateMany({ where: { id }, data: { name: clean } });
}

export async function deleteReportTemplate(id: string): Promise<void> {
  await prisma.reportTemplate.deleteMany({ where: { id } });
}
