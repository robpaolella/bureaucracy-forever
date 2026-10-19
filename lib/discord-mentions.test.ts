import { describe, expect, it } from 'vitest';
import { mentionedUserIds, parseMentions, UNKNOWN_USER } from './discord-mentions';

const users = { '111': 'Ledgerline' };
const t = (text: string) => ({ type: 'text', text });

describe('parseMentions', () => {
  it('returns nothing for an empty body', () => expect(parseMentions('', users)).toEqual([]));
  it('keeps plain text whole, including line breaks, @everyone and @here', () => {
    const s = 'a\n@everyone @here b';
    expect(parseMentions(s, users)).toEqual([t(s)]);
  });
  it('names a person from the lookup', () => expect(parseMentions('<@111>', users)).toEqual([{ type: 'user', label: '@Ledgerline' }]));
  it('handles the <@!id> form', () => expect(parseMentions('<@!111>', users)).toEqual([{ type: 'user', label: '@Ledgerline' }]));
  it('falls back for an unknown person', () => expect(parseMentions('<@999>', users)).toEqual([{ type: 'user', label: UNKNOWN_USER }]));
  it('does not match inherited object keys', () => expect(parseMentions('<@1>', {})).toEqual([{ type: 'user', label: UNKNOWN_USER }]));
  it('shows roles and channels generically', () => {
    expect(parseMentions('<@&5><#6>', users)).toEqual([{ type: 'role', label: '@role' }, { type: 'channel', label: '#channel' }]);
  });
  it('turns custom emoji into plain text, animated or not', () => {
    expect(parseMentions('hi <:wave:123> and <a:party:456>!', users)).toEqual([t('hi :wave: and :party:!')]);
  });
  it('handles several tags with tags at the start and end and punctuation around', () => {
    expect(parseMentions('<@111>, see <#6>: <@&5>.', users)).toEqual([
      { type: 'user', label: '@Ledgerline' }, t(', see '), { type: 'channel', label: '#channel' }, t(': '), { type: 'role', label: '@role' }, t('.'),
    ]);
  });
  it.each(['<@abc>', '<@ 123>', '<@123', '<@&>', '<#>', '<:wave:>', '<script>alert(1)</script>'])('leaves look-alike %s as text', (s) => {
    expect(parseMentions(s, users)).toEqual([t(s)]);
  });
});

describe('mentionedUserIds', () => {
  it('collects person ids only', () => expect(mentionedUserIds('<@1> <@!2> <@&3> <#4> <@1>')).toEqual(['1', '2', '1']));
});
