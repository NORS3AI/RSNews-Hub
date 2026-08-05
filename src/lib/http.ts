import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

/**
 * Parse + validate a JSON request body against a zod schema. Returns the typed
 * data, or a ready-to-return 400 response — so a malformed/hostile body becomes a
 * clean 400 instead of, say, a non-string id reaching Prisma and throwing a 500.
 *
 *   const parsed = await parseJson(req, MySchema);
 *   if (!parsed.ok) return parsed.res;
 *   use(parsed.data);
 */
export async function parseJson<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, res: NextResponse.json({ error: 'invalid input' }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}
