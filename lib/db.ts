import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

/**
 * One Prisma client per process, on the pooled Neon connection string through the pg
 * driver adapter (Prisma 7 has no bundled engine). Migrations use DIRECT_URL instead;
 * see prisma.config.ts. The global cache keeps `next dev` hot reloads from opening a
 * new pool on every change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
