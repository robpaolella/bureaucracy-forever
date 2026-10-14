import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { isProductionDeployment } from '@/lib/deploy-env';

/** The public pages, in nav order. No lastModified: a build-time stamp would only pretend to know. */
export const PUBLIC_PATHS = ['/', '/about', '/schedule', '/recruitment'] as const;

/** Empty outside production: other deployments are not offered to search engines. */
export default function sitemap(env: Record<string, string | undefined> = process.env): MetadataRoute.Sitemap {
  if (!isProductionDeployment(env)) return [];
  return PUBLIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: path === '/' || path === '/recruitment' ? 'weekly' : 'monthly', priority: path === '/' ? 1 : 0.7 }));
}
