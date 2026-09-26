import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.fn();

vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class {} }));
vi.mock('@/lib/generated/prisma/client', () => ({
  PrismaClient: class {
    user = { count: () => 1 };
    availability = { count: () => 2 };
    $disconnect() {
      return this;
    }
    constructor() {
      constructed();
    }
  },
}));

describe('db', () => {
  beforeEach(() => {
    vi.resetModules();
    constructed.mockClear();
    delete (globalThis as { prisma?: unknown }).prisma;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not connect at import and fails loudly on first use without a URL', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const { db } = await import('./db');
    expect(constructed).not.toHaveBeenCalled();
    expect(() => db.user).toThrow('DATABASE_URL must be set');
  });

  it('creates one client per process in production, however often it is touched', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://x');
    const { db } = await import('./db');
    db.user.count();
    db.availability.count();
    db.user.count();
    expect(constructed).toHaveBeenCalledTimes(1);
    expect((globalThis as { prisma?: unknown }).prisma).toBeUndefined();
  });

  it('reuses the client across a development hot reload', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', 'postgresql://x');
    const first = await import('./db');
    first.db.user.count();
    vi.resetModules(); // the module is evaluated again, as on hot reload
    const second = await import('./db');
    second.db.availability.count();
    expect(constructed).toHaveBeenCalledTimes(1);
  });

  it('binds client methods so `this` is the real client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://x');
    const { db } = await import('./db');
    const disconnect = db.$disconnect;
    expect(disconnect()).toBeDefined();
  });
});
