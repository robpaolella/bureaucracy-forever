import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { CharacterForm } from './CharacterForm';
import { MemberCharacterDialog, type MemberCharacter } from './MemberCharacterDialog';
import { Modal } from '@/components/ui';
import { MEMBER_EDITOR } from '@/content/roster-editor';
import { RosterTable } from './RosterTable';
import type { RosterRow } from '@/lib/roster';

const hooks = vi.hoisted(() => ({ values: null as unknown[] | null, index: 0 }));
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return { ...react, useState: (initial: unknown) => {
    if (!hooks.values) return react.useState(initial);
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values![index] = value; }];
  } };
});
afterEach(() => { hooks.values = null; vi.unstubAllGlobals(); vi.clearAllMocks(); });

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const main: MemberCharacter = { id: 'main', name: 'Red Tape', wowClass: 'warrior', spec: 'Protection', role: 'tank', isMain: true };
const alt: MemberCharacter = { id: 'alt', name: 'Blue Ink', wowClass: 'mage', spec: 'Frost', role: 'ranged', isMain: false };

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: ReactNode): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children as ReactNode), ...nodes(value.props.actions as ReactNode)];
}
function view(characters: MemberCharacter[] = [main, alt]) { hooks.index = 0; return nodes(MemberCharacterDialog({ characters, rank: 'raider' })); }
function button(label: string, characters?: MemberCharacter[]) {
  const node = view(characters).find((n) => n.props['aria-label'] === label || n.props.children === label);
  expect(node).toBeDefined();
  return node!.props.onClick as () => void;
}

function render(characters: MemberCharacter[] = [main, alt]) {
  return renderToStaticMarkup(<MemberCharacterDialog characters={characters} rank="raider" />);
}

describe('MemberCharacterDialog', () => {
  it('shows the main without actions and lets the member edit an alt', () => {
    const html = render();
    expect(html).toContain('Red Tape');
    expect(html).toContain(MEMBER_EDITOR.main);
    expect(html).toContain('aria-label="Edit Blue Ink"');
    expect(html).not.toContain('aria-label="Edit Red Tape"');
  });

  it('does not offer an add button without a main', () => {
    expect(render([alt])).toContain(MEMBER_EDITOR.noMain);
    expect(render([alt])).not.toContain(`>${MEMBER_EDITOR.addAlt}<`);
  });

  it('shows the entry point only on the viewer’s own row', () => {
    const rows: RosterRow[] = [
      { id: 'viewer', name: 'Redtape', character: 'Red Tape', wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'raider', attendance: null, joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'other', name: 'Ledgerline', character: 'Blue Ink', wowClass: 'mage', spec: 'Frost', role: 'ranged', rank: 'officer', attendance: null, joinedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const html = renderToStaticMarkup(<RosterTable rows={rows} viewer={{ id: 'viewer', rank: 'raider', characters: [main] }} />);
    expect(html.match(/Manage characters/g)).toHaveLength(6); // Desktop and phone markup each contain one button and its dialog title.
  });

  it.each(['You can have up to 8 characters.', 'You already have a character with that name.'])('returns validation errors for the form: %s', async (error) => {
    hooks.values = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status: 409 })));
    button(MEMBER_EDITOR.manageCharacters)();
    button(MEMBER_EDITOR.addAlt)();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' })).toBe(error);
  });

  it('adds and edits alts without a rank picker, then confirms before removal', () => {
    hooks.values = [];
    button(MEMBER_EDITOR.manageCharacters)();
    button(MEMBER_EDITOR.addAlt)();
    expect(view().find((node) => node.type === CharacterForm)?.props.showRank).toBe(false);

    hooks.values = [];
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(form.props.showRank).toBe(false);
    (form.props.onRemove as () => void)();
    const dialog = view().filter((node) => node.type === Modal).at(-1)!;
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.children).toContain(MEMBER_EDITOR.removeBody);
  });
});
