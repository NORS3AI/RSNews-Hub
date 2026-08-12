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
  // Static baseline security headers on every response. The Content-Security-
  // Policy (which is runtime-configurable via FRAME_ANCESTORS and path-dependent)
  // is set in middleware.ts instead — `next.config` headers are baked at build
  // time, so they can't read deploy-time env.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        // Force HTTPS on repeat visits. Browsers ignore this over plain HTTP, so
        // it's safe to send always; the edge/proxy still terminates TLS.
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
};
export default nextConfig;
