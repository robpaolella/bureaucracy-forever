import { describe, expect, it } from 'vitest';
import { DISCORD_ISSUER, discordProvider } from './discord-provider';

// Auth.js keeps what we pass in `options` and merges it over the provider defaults later.
const options = () => discordProvider().options as { issuer?: string; authorization?: { params?: { scope?: string } } };

describe('discordProvider', () => {
  it('sets the issuer Discord returns in its RFC 9207 iss parameter', () => {
    expect(DISCORD_ISSUER).toBe('https://discord.com');
    expect(options().issuer).toBe('https://discord.com');
  });

  it('keeps the identify-only scope', () => {
    expect(options().authorization?.params?.scope).toBe('identify');
  });
});
