import { describe, expect, it } from 'vitest';
import { CLOSING, HERO } from './home';

describe('home copy', () => {
  it('opens with the approved hero intro', () => {
    expect(HERO.lede).toBe(
      "Bureaucracy has raided together since 2011. On Smolderweb, we were the top guild from Molten Core through Naxxramas, with server firsts, the fastest clear times and a top 150 regional Naxxramas clear in week one. Now we're bringing the same team to WoW Forever.",
    );
  });

  it('closes with the approved headline and text', () => {
    expect(CLOSING.headline).toBe('Ready to compete?');
    expect(CLOSING.text).toBe(
      "We're recruiting skilled, prepared raiders for WoW Forever. We read every application and respond within a few days.",
    );
  });

  it('has no exclamation marks', () => {
    expect(`${HERO.lede}${CLOSING.headline}${CLOSING.text}`).not.toContain('!');
  });
});
