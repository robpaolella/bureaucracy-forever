import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { isProductionDeployment } from '@/lib/deploy-env';

/**
 * Public pages index; everything behind the login, the API and the dev pages do not (docs/03).
 * Elsewhere there is no sitemap, and pages stay crawlable so the noindex header (next.config.ts) is seen.
 */
export default function robots(env: Record<string, string | undefined> = process.env): MetadataRoute.Robots {
  const rules = [{ userAgent: '*', allow: '/', disallow: ['/members/', '/officers/', '/api/', '/dev/', '/login'] }];
  if (!isProductionDeployment(env)) return { rules };
  return {
    rules,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
