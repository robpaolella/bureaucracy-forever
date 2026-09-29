/**
 * Guard for scripts that write data (the seed, and anything like it later). A write is
 * allowed only against a local database, or against staging when the run was started
 * through prisma/with-staging-env.ts (DB_TARGET=staging) and the URL is literally one of
 * the strings in .env.staging. Anything else is refused, so a .env.local pointing at the
 * production database can never be wiped by accident. There is no override flag on purpose.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

export const STAGING_ENV_FILE = '.env.staging';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type WriteTarget = { ok: true; target: 'local' | 'staging' } | { ok: false; reason: string };

/** Local means the host is loopback or a `.localhost` name. */
export function isLocalDatabaseUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

export function classifyWriteTarget(
  url: string | undefined,
  opts: { dbTarget: string | undefined; stagingUrls: readonly string[] },
): WriteTarget {
  if (!url) return { ok: false, reason: 'No database URL is set.' };
  if (isLocalDatabaseUrl(url)) return { ok: true, target: 'local' };
  if (opts.dbTarget === 'staging') {
    if (opts.stagingUrls.includes(url)) return { ok: true, target: 'staging' };
    return { ok: false, reason: `DB_TARGET=staging, but the URL is not one from ${STAGING_ENV_FILE}.` };
  }
  return {
    ok: false,
    reason: `The database is not local. To write to staging, use the db:staging:* npm scripts, which load ${STAGING_ENV_FILE}.`,
  };
}

/** DATABASE_URL and DIRECT_URL from .env.staging, or an empty object when the file is missing. */
export function readStagingEnv(path = STAGING_ENV_FILE): Record<string, string> {
  if (!existsSync(path)) return {};
  return parse(readFileSync(path));
}

/** Throws unless `url` is a safe write target. Never includes the URL in the message. */
export function assertWriteTarget(url: string | undefined, env: NodeJS.ProcessEnv = process.env): 'local' | 'staging' {
  const staging = readStagingEnv();
  const stagingUrls = [staging.DATABASE_URL, staging.DIRECT_URL].filter((u): u is string => Boolean(u));
  const result = classifyWriteTarget(url, { dbTarget: env.DB_TARGET, stagingUrls });
  if (!result.ok) throw new Error(`Refusing to write to this database. ${result.reason}`);
  return result.target;
}
