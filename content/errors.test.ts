import { describe, expect, it } from 'vitest';
import { ERROR, NOT_FOUND } from './errors';

describe('status page copy', () => {
  it('uses the familiar not-found wording', () => {
    expect(NOT_FOUND.title).toBe('Page not found');
    expect(NOT_FOUND.body).toBe('The link might be broken, or the page may have moved.');
  });

  it('has no quips and no officer-only instructions', () => {
    const all = Object.values({ ...NOT_FOUND, ...ERROR, errorBody: ERROR.body }).join(' ');
    expect(all).not.toMatch(/filed under|paperwork|officer/i);
  });

  it('tells the visitor what to do on the error page', () => {
    expect(ERROR.title).toBe('Something went wrong');
    expect(ERROR.body).toMatch(/Try again/);
  });
});
