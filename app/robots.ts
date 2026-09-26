import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

/** Public pages index; everything behind the login, the API and the dev pages do not (docs/03). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/members/', '/officers/', '/api/', '/dev/', '/login'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
