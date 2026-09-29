import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { assertWriteTarget } from './prisma/write-guard';

// The app keeps secrets in .env.local (gitignored); Prisma's CLI does not load env files
// on its own. .env is read too, for CI or a host that provides one.
loadEnv({ path: '.env.local' });
loadEnv();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

// `migrate reset` drops every table. Refuse it unless the target is a local database or
// staging reached through `npm run db:staging:reset`; see prisma/write-guard.ts.
const args = process.argv.slice(2);
if (args.includes('migrate') && args.includes('reset')) assertWriteTarget(url);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations need the direct (non-pooled) host. The app itself connects through
    // the pooled DATABASE_URL in lib/db.ts. `||`, not `??`: a host that defines
    // DIRECT_URL as an empty string should fall back rather than fail on an empty URL.
    url,
  },
});
