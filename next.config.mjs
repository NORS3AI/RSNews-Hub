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
};
export default nextConfig;
