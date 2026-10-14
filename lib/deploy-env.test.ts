import { describe, expect, it } from 'vitest';
import { isProductionDeployment, isStagingDeployment } from './deploy-env';

describe('isStagingDeployment', () => {
  it('is true only for a preview of the staging branch', () => {
    expect(isStagingDeployment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(true);
  });

  it('is false for production, other previews and local', () => {
    expect(isStagingDeployment({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' })).toBe(false);
    expect(isStagingDeployment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/loot' })).toBe(false);
    expect(isStagingDeployment({})).toBe(false);
  });
});

describe('isProductionDeployment', () => {
  it('is true only when VERCEL_ENV is production', () => {
    expect(isProductionDeployment({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isProductionDeployment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(false);
    expect(isProductionDeployment({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProductionDeployment({})).toBe(false);
  });
});
