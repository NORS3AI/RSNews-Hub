import { NextResponse, type NextRequest } from 'next/server';

// Assigns a stable anonymous reader id, and sets the Content-Security-Policy at
// runtime (so it can read deploy-time env, unlike next.config headers):
//  - served uploads get a strict sandbox (neuters any opt-in SVG),
//  - every other route scopes who may frame the hub via `frame-ancestors`, so
//    the parent RS News site can embed it (set FRAME_ANCESTORS) but others can't
//    clickjack it. Defaults to same-origin only.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const csp = req.nextUrl.pathname.startsWith('/uploads/')
    ? "default-src 'none'; sandbox; style-src 'unsafe-inline'"
    : `frame-ancestors ${process.env.FRAME_ANCESTORS?.trim() || "'self'"};`;
  res.headers.set('Content-Security-Policy', csp);

  if (!req.cookies.get('rsnews_reader')) {
    const id = crypto.randomUUID();
    res.cookies.set('rsnews_reader', id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
