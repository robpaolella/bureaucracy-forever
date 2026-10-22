'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { stripQuery } from '@/lib/analytics';

/**
 * Vercel Analytics and Speed Insights. A client component because `beforeSend` is a function,
 * which a server component can't pass down. Only page addresses are recorded, without their
 * query string; no visitor ids or custom events.
 */
export function AnalyticsScripts() {
  return (
    <>
      <Analytics beforeSend={stripQuery} />
      <SpeedInsights beforeSend={stripQuery} />
    </>
  );
}
