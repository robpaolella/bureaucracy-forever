/**
 * Which deployment this is, from Vercel's system environment variables (unset locally).
 * Server-side only: these are not NEXT_PUBLIC, so client components always see undefined.
 */
export const STAGING_BRANCH = 'staging';

/** The long-lived `staging` branch's preview deployment (staging.bureauguild.com). */
export function isStagingDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === STAGING_BRANCH;
}
