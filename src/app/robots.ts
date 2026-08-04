import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

const base = siteUrl || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/login', '/register'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
