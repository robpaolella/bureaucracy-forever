import { describe, expect, it } from 'vitest';
import { decisionDm } from '@/content/dm-templates';

describe('accepted decision DM', () => {
  it('describes the trial without promising loot or gear', () => {
    const message = decisionDm('accepted', 'Sample Character');

    expect(message).toContain('two-week trial');
    expect(message).not.toMatch(/loot|gear/i);
  });
});
