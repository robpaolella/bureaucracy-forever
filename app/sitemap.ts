import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

/** The public pages, in nav order. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['/', '/about', '/schedule', '/recruitment', '/loot'].map((path) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency: path === '/' || path === '/recruitment' ? 'weekly' : 'monthly', priority: path === '/' ? 1 : 0.7 }));
}
