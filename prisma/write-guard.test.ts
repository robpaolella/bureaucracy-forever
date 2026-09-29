import { describe, expect, it } from 'vitest';
import { classifyWriteTarget, databaseHost, isLocalDatabaseUrl } from './write-guard';

const NEON_PROD = 'postgresql://u:p@ep-prod-pooler.us-east-2.aws.neon.tech/db?sslmode=require';
const NEON_STAGING = 'postgresql://u:p@ep-staging.us-east-2.aws.neon.tech/db?sslmode=require';

describe('isLocalDatabaseUrl', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'postgresql://u:p@127.0.0.1/db',
    'postgresql://u:p@[::1]:5432/db',
    'postgres://u@db.localhost/db',
  ])('treats %s as local', (url) => expect(isLocalDatabaseUrl(url)).toBe(true));

  it.each([
    NEON_PROD,
    'postgresql://u:p@localhost.evil.com/db',
    'postgresql://u@/db?host=/tmp',
    'postgresql://u@localhost/db?host=ep-prod.neon.tech',
    'postgresql://u@localhost/db?hostaddr=10.0.0.1',
    'postgresql://u@localhost/db?service=prod',
    'not a url',
  ])('treats %s as remote', (url) =>
    expect(isLocalDatabaseUrl(url)).toBe(false),
  );
});

describe('databaseHost', () => {
  it('treats pooled and direct Neon hosts as one', () => {
    expect(databaseHost(NEON_PROD)).toBe('ep-prod.us-east-2.aws.neon.tech');
    expect(databaseHost('postgresql://u:p@ep-prod.us-east-2.aws.neon.tech/db')).toBe('ep-prod.us-east-2.aws.neon.tech');
  });
});

describe('classifyWriteTarget', () => {
  const stagingUrls = [NEON_STAGING];
  const base = { stagingUrls, defaultUrls: [NEON_PROD] };

  it('allows a local database with no flag', () => {
    expect(classifyWriteTarget('postgresql://u@localhost/db', { ...base, dbTarget: undefined })).toEqual({
      ok: true,
      target: 'local',
    });
  });

  it('refuses a remote database without DB_TARGET=staging, even the staging one', () => {
    expect(classifyWriteTarget(NEON_STAGING, { ...base, dbTarget: undefined }).ok).toBe(false);
    expect(classifyWriteTarget(NEON_PROD, { ...base, dbTarget: undefined }).ok).toBe(false);
  });

  it('allows staging only when the URL is one from .env.staging', () => {
    expect(classifyWriteTarget(NEON_STAGING, { ...base, dbTarget: 'staging' })).toEqual({ ok: true, target: 'staging' });
    expect(classifyWriteTarget(NEON_PROD, { ...base, dbTarget: 'staging' }).ok).toBe(false);
  });

  it('refuses when .env.staging is missing', () => {
    expect(classifyWriteTarget(NEON_STAGING, { ...base, dbTarget: 'staging', stagingUrls: [] }).ok).toBe(false);
  });

  it('refuses staging when .env.staging shares a host with .env.local', () => {
    const pasted = 'postgresql://u:p@ep-prod.us-east-2.aws.neon.tech/db';
    expect(classifyWriteTarget(pasted, { dbTarget: 'staging', stagingUrls: [pasted], defaultUrls: [NEON_PROD] }).ok).toBe(false);
  });

  it('refuses when no URL is set', () => {
    expect(classifyWriteTarget(undefined, { ...base, dbTarget: 'staging' }).ok).toBe(false);
  });
});
