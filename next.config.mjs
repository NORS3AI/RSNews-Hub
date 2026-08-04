/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server output for Docker / self-host (Vercel & Railway ignore
  // this and use their own builders). See Dockerfile + DEPLOYMENT.md.
  output: 'standalone',
  // The app renders images with plain <img>, never next/image, so the Next image
  // optimizer is unused. Disabling it removes that endpoint's attack surface
  // (incl. the remotePatterns image-optimizer DoS class of issue) and drops the
  // dependency on a wildcard remote-host allowlist.
  images: { unoptimized: true },
  async redirects() {
    return [
      { source: '/', destination: '/docs', permanent: false },
      { source: '/main', destination: '/docs', permanent: false },
    ];
  },
  // Baseline security headers on every response. The hub is meant to be embedded
  // in the parent RS News site, so we DON'T blanket-deny framing — instead we
  // scope who may frame us via CSP `frame-ancestors` (set FRAME_ANCESTORS to the
  // parent origin(s), space-separated; defaults to same-origin only).
  async headers() {
    const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'self'";
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        { key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors};` },
      ],
    }];
  },
};
export default nextConfig;
