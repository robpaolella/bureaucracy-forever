import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

/** The public pages, in nav order. No lastModified: a build-time stamp would only pretend to know. */
export const PUBLIC_PATHS = ['/', '/about', '/schedule', '/recruitment', '/loot'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: path === '/' || path === '/recruitment' ? 'weekly' : 'monthly', priority: path === '/' ? 1 : 0.7 }));
}
