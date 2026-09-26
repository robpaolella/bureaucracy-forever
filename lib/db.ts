import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

/**
 * One Prisma client per process, on the pooled Neon connection string through the pg
 * driver adapter (Prisma 7 has no bundled engine). Migrations use DIRECT_URL instead;
 * see prisma.config.ts. The global cache keeps `next dev` hot reloads from opening a
 * new pool on every change.
 *
 * The client is created on first use, not at import: `next build` imports every route
 * module while collecting page data, and CI builds with no database at all. A missing
 * DATABASE_URL still fails loudly, on the first query instead of at startup.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  return client;
}

function instance(): PrismaClient {
  return globalForPrisma.prisma ?? create();
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = instance();
    const value = Reflect.get(client, prop) as unknown;
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
