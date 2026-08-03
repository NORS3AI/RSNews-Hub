/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async redirects() {
    return [
      { source: '/', destination: '/docs', permanent: false },
      { source: '/main', destination: '/docs', permanent: false },
    ];
  },
};
export default nextConfig;
