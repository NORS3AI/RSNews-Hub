import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { captureError } from '@/lib/logger';
import {
  getSaved, toggleFavorite, toggleToRead, removeToRead, clearToRead, addClipping, removeClipping, mergeLocal,
  normalizeSavedItem, normalizeClipping, type SavedBundle,
} from '@/lib/saved';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMPTY: SavedBundle = { favorites: [], toRead: [], clippings: [] };

// Read the signed-in member's saved state. Anonymous → signedIn:false + empty
// (the client then uses its local-only store).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ signedIn: false, ...EMPTY });
  const bundle = await getSaved(user.id);
  return NextResponse.json({ signedIn: true, ...bundle });
}

// Mutate saved state. Body: { op, item? , id?, clipping?, local? }. Returns the
// fresh bundle so the client can reconcile. 401 when not signed in.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const op = String(body.op || '');

  try {
    switch (op) {
      case 'toggleFavorite': {
        const item = normalizeSavedItem(body.item);
        if (!item) return NextResponse.json({ error: 'bad item' }, { status: 400 });
        return NextResponse.json(await toggleFavorite(user.id, item));
      }
      case 'toggleToRead': {
        const item = normalizeSavedItem(body.item);
        if (!item) return NextResponse.json({ error: 'bad item' }, { status: 400 });
        return NextResponse.json(await toggleToRead(user.id, item));
      }
      case 'removeToRead':
        return NextResponse.json(await removeToRead(user.id, String(body.id || '')));
      case 'clearToRead':
        return NextResponse.json(await clearToRead(user.id));
      case 'addClipping': {
        const clip = normalizeClipping(body.clipping);
        if (!clip) return NextResponse.json({ error: 'bad clipping' }, { status: 400 });
        return NextResponse.json(await addClipping(user.id, clip));
      }
      case 'removeClipping':
        return NextResponse.json(await removeClipping(user.id, String(body.id || '')));
      case 'merge':
        return NextResponse.json(await mergeLocal(user.id, (body.local as Partial<SavedBundle>) || {}));
      default:
        return NextResponse.json({ error: 'unknown op' }, { status: 400 });
    }
  } catch (e) {
    captureError(e, { route: 'saved', op });
    return NextResponse.json({ error: 'save failed' }, { status: 500 });
  }
}
