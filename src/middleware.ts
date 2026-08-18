import { NextResponse, type NextRequest } from 'next/server';

// Builds the app Content-Security-Policy. `script-src` is strict — only same-
// origin bundles and the per-request nonce run, so an injected <script> (or an
// inline handler that ever slipped past the HTML sanitizer) is refused by the
// browser: a second lock behind lib/sanitize. `style-src` keeps 'unsafe-inline'
// because the UI uses React inline style= attributes and admin/vendor accent
// colors throughout (nonces can't cover style attributes, and style injection is
// far lower-risk than script). frame-ancestors stays env-configurable so the
// parent RS News site can embed the hub while others can't clickjack it.
function appCsp(nonce: string): string {
  const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'self'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",   // uploads (self), data-URI + remote https ad/cover creatives
    "media-src 'self' data: blob: https:", // video ad creatives
    "font-src 'self' data:",
    "connect-src 'self'",                    // analytics beacon + app fetches are same-origin
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
}

// Assigns a stable anonymous reader id, and sets the Content-Security-Policy at
// runtime (so it can read deploy-time env, unlike next.config headers). Served
// uploads get a strict sandbox (neuters any opt-in SVG); every other route gets
// the nonce-based app policy above.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/uploads/')) {
    const res = NextResponse.next();
    res.headers.set('Content-Security-Policy', "default-src 'none'; sandbox; style-src 'unsafe-inline'");
    return res;
  }

  // Per-request nonce. Passed to the render via request headers so the root
  // layout can stamp its inline bootstrap script; Next reads the nonce from the
  // request CSP header and applies it to the framework's own inline scripts too.
  const nonce = crypto.randomUUID();
  const csp = appCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
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
