import { NextResponse, type NextRequest } from 'next/server';

// Assigns a stable anonymous reader id so reading history (and thus
// recommendations) work even before a visitor signs in.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get('rsnews_reader')) {
    const id = crypto.randomUUID();
    res.cookies.set('rsnews_reader', id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
