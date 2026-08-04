/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server output for Docker / self-host (Vercel & Railway ignore
  // this and use their own builders). See Dockerfile + DEPLOYMENT.md.
  output: 'standalone',
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async redirects() {
    return [
      { source: '/', destination: '/docs', permanent: false },
      { source: '/main', destination: '/docs', permanent: false },
    ];
  },
};
export default nextConfig;
