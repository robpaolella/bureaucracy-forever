/**
 * Guard for scripts that write data (the seed, and anything like it later). A write is
 * allowed only against a local database, or against staging when the run was started
 * through prisma/with-staging-env.ts (DB_TARGET=staging) and the URL is literally one of
 * the strings in .env.staging, on a host that neither .env.local nor .env uses (so a
 * production string pasted into .env.staging is refused too). Anything else is refused, so a
 * .env.local pointing at the production database can never be wiped by accident. There is
 * no override flag on purpose.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

export const STAGING_ENV_FILE = '.env.staging';
/** The files the app and Prisma read by default; staging must never share a host with them. */
const DEFAULT_ENV_FILES = ['.env.local', '.env'];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type WriteTarget = { ok: true; target: 'local' | 'staging' } | { ok: false; reason: string };

/**
 * Local means the host is loopback or a `.localhost` name. A `host`, `hostaddr` or `service`
 * query parameter can redirect the pg driver elsewhere, so any of them makes it not local.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (['host', 'hostaddr', 'service'].some((k) => parsed.searchParams.has(k))) return false;
  const host = parsed.hostname.toLowerCase();
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

/** The database host with Neon's `-pooler` suffix dropped, so pooled and direct compare equal. */
export function databaseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^([^.]+)-pooler\./, '$1.');
  } catch {
    return null;
  }
}

export function classifyWriteTarget(
  url: string | undefined,
  opts: { dbTarget: string | undefined; stagingUrls: readonly string[]; defaultUrls: readonly string[] },
): WriteTarget {
  if (!url) return { ok: false, reason: 'No database URL is set.' };
  if (isLocalDatabaseUrl(url)) return { ok: true, target: 'local' };
  if (opts.dbTarget === 'staging') {
    if (!opts.stagingUrls.includes(url)) {
      return { ok: false, reason: `DB_TARGET=staging, but the URL is not one from ${STAGING_ENV_FILE}.` };
    }
    const host = databaseHost(url);
    if (!host || opts.defaultUrls.some((u) => databaseHost(u) === host)) {
      return {
        ok: false,
        reason: `${STAGING_ENV_FILE} points at the same database host as ${DEFAULT_ENV_FILES.join(' or ')}. Staging must be its own Neon branch.`,
      };
    }
    return { ok: true, target: 'staging' };
  }
  return {
    ok: false,
    reason: `The database is not local. To write to staging, use the db:staging:* npm scripts, which load ${STAGING_ENV_FILE}.`,
  };
}

/** The variables in an env file, or an empty object when the file is missing. */
export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return parse(readFileSync(path));
}

export function readStagingEnv(): Record<string, string> {
  return readEnvFile(STAGING_ENV_FILE);
}

function databaseUrls(env: Record<string, string>): string[] {
  return [env.DATABASE_URL, env.DIRECT_URL].filter((u): u is string => Boolean(u));
}

/** Throws unless `url` is a safe write target. Never includes the URL in the message. */
export function assertWriteTarget(url: string | undefined, env: NodeJS.ProcessEnv = process.env): 'local' | 'staging' {
  const stagingUrls = databaseUrls(readStagingEnv());
  const defaultUrls = DEFAULT_ENV_FILES.flatMap((f) => databaseUrls(readEnvFile(f)));
  const result = classifyWriteTarget(url, { dbTarget: env.DB_TARGET, stagingUrls, defaultUrls });
  if (!result.ok) throw new Error(`Refusing to write to this database. ${result.reason}`);
  return result.target;
}
