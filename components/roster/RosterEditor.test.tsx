import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EDITOR } from '@/content/roster-editor';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { RosterEditor, type EditorMember } from './RosterEditor';

const member: EditorMember = {
  userId: 'member-1',
  discordName: 'Paperclip',
  rank: 'raider',
  main: { id: 'main-1', name: 'Red Tape', wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'raider' },
  alts: [{ id: 'alt-1', name: 'Blue Ink', wowClass: 'mage', spec: 'Frost', role: 'ranged', rank: 'raider' }],
};

function render(members: EditorMember[] = [member]) {
  return renderToStaticMarkup(<RosterEditor members={members} />);
}

describe('RosterEditor', () => {
  it('shows an alt under its member and offers the existing edit control', () => {
    const html = render();
    expect(html).toContain('Blue Ink · Mage · Frost · Ranged');
    expect(html).toContain(`aria-label="${EDITOR.edit} Blue Ink"`);
  });

  it('adds an alt control only for members with a main', () => {
    expect(render()).toContain(`aria-label="${EDITOR.addAlt} for ${member.discordName}"`);
    expect(render([{ ...member, main: null, alts: [] }])).not.toContain(EDITOR.addAlt);
  });

  it('keeps plain-language copy ready for the main-change confirmation', () => {
    expect(EDITOR.makeMainTitle).toBe('Make this character the main?');
    expect(EDITOR.makeMainBody).toBe('The current main becomes an alt. Past raids keep the character they recorded.');
    expect(EDITOR.makeMainConfirm).toBe(EDITOR.makeMain);
  });
});
