import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The app keeps secrets in .env.local (gitignored); Prisma's CLI does not load env files
// on its own. .env is read too, for CI or a host that provides one.
loadEnv({ path: '.env.local' });
loadEnv();

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
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
