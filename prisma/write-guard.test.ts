import { describe, expect, it } from 'vitest';
import { classifyWriteTarget, isLocalDatabaseUrl } from './write-guard';

const NEON_PROD = 'postgresql://u:p@ep-prod-pooler.us-east-2.aws.neon.tech/db?sslmode=require';
const NEON_STAGING = 'postgresql://u:p@ep-staging.us-east-2.aws.neon.tech/db?sslmode=require';

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'postgresql://u:p@127.0.0.1/db',
    'postgresql://u:p@[::1]:5432/db',
    'postgres://u@db.localhost/db',
  ])('treats %s as local', (url) => expect(isLocalDatabaseUrl(url)).toBe(true));

  it.each([NEON_PROD, 'postgresql://u:p@localhost.evil.com/db', 'postgresql://u@/db?host=/tmp', 'not a url'])('treats %s as remote', (url) =>
    expect(isLocalDatabaseUrl(url)).toBe(false),
  );
});

describe('classifyWriteTarget', () => {
  const stagingUrls = [NEON_STAGING];

  it('allows a local database with no flag', () => {
    expect(classifyWriteTarget('postgresql://u@localhost/db', { dbTarget: undefined, stagingUrls })).toEqual({
      ok: true,
      target: 'local',
    });
  });

  it('refuses a remote database without DB_TARGET=staging, even the staging one', () => {
    expect(classifyWriteTarget(NEON_STAGING, { dbTarget: undefined, stagingUrls }).ok).toBe(false);
    expect(classifyWriteTarget(NEON_PROD, { dbTarget: undefined, stagingUrls }).ok).toBe(false);
  });

  it('allows staging only when the URL is one from .env.staging', () => {
    expect(classifyWriteTarget(NEON_STAGING, { dbTarget: 'staging', stagingUrls })).toEqual({ ok: true, target: 'staging' });
    expect(classifyWriteTarget(NEON_PROD, { dbTarget: 'staging', stagingUrls }).ok).toBe(false);
  });

  it('refuses when .env.staging is missing', () => {
    expect(classifyWriteTarget(NEON_STAGING, { dbTarget: 'staging', stagingUrls: [] }).ok).toBe(false);
  });

  it('refuses when no URL is set', () => {
    expect(classifyWriteTarget(undefined, { dbTarget: 'staging', stagingUrls }).ok).toBe(false);
  });
});
