import { describe, expect, it } from 'vitest';
import { checkDatabase } from './run';

const local = 'postgresql://worker:worker@127.0.0.1:54321/bureau';
const env = { DATABASE_URL: local, DIRECT_URL: local, DB_TARGET: 'local', NODE_ENV: 'development' };
describe('verification Doctor database guard', () => {
  it('accepts the exact local development database', () => expect(() => checkDatabase(env, local)).not.toThrow());
  it.each(['postgresql://dummy:dummy@example.com/bureau', '', `${local}?host=example.com`])('refuses non-local or redirected databases without exposing the URL', (url) => {
    expect(() => checkDatabase({ ...env, DATABASE_URL: url }, local)).toThrow('Doctor refused: database is not local.');
  });
  it.each([{ DATABASE_URL: local.replace('54321', '54322') }, { DIRECT_URL: 'postgresql://dummy@example.com/bureau' }, { DB_TARGET: 'staging' }, { NODE_ENV: 'production' }])('refuses wrong identity or mode: %o', (change) => {
    expect(() => checkDatabase({ ...env, ...change }, local)).toThrow('not this folder’s development database');
  });
});
