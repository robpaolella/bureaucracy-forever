/**
 * Runs a command against the staging database: `tsx prisma/with-staging-env.ts <cmd> [args…]`.
 * Loads .env.staging over whatever the shell and .env.local provide (dotenv never overrides
 * a variable that is already set, so prisma.config.ts and the seed pick these up), marks the
 * run DB_TARGET=staging for the write guard, and checks the target before starting anything.
 */
import { spawnSync } from 'node:child_process';
import { assertWriteTarget, readStagingEnv, STAGING_ENV_FILE } from './write-guard';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: tsx prisma/with-staging-env.ts <command> [args…]');
  process.exit(2);
}

const staging = readStagingEnv();
if (!staging.DATABASE_URL || !staging.DIRECT_URL) {
  console.error(`${STAGING_ENV_FILE} must define DATABASE_URL and DIRECT_URL.`);
  process.exit(2);
}

const env: NodeJS.ProcessEnv = { ...process.env, ...staging, DB_TARGET: 'staging' };
try {
  assertWriteTarget(env.DIRECT_URL, env);
  assertWriteTarget(env.DATABASE_URL, env);
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}

const result = spawnSync(command, args, { stdio: 'inherit', env });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
