import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { CharacterForm } from './CharacterForm';
import { Modal } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';

// Exercise the component's event handlers without adding a DOM dependency.
// Rendering/real focus and native-dialog behaviour are covered in browser proof.
const hooks = vi.hoisted(() => ({ values: null as unknown[] | null, index: 0 }));
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return { ...react,
    useState: (initial: unknown) => {
      if (!hooks.values) return react.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.values)) hooks.values[index] = initial;
      return [hooks.values[index], (value: unknown) => { hooks.values![index] = value; }];
    },
    useMemo: (factory: () => unknown, deps: unknown[]) => hooks.values ? factory() : react.useMemo(factory, deps),
  };
});
afterEach(() => { hooks.values = null; vi.unstubAllGlobals(); vi.clearAllMocks(); });
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

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: ReactNode): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children as ReactNode), ...nodes(value.props.actions as ReactNode)];
}
function view() { hooks.index = 0; return nodes(RosterEditor({ members: [member] })); }
function button(label: string) {
  const node = view().find((n) => n.props['aria-label'] === label || n.props.children === label);
  expect(node).toBeDefined();
  return node!.props.onClick as () => Promise<void>;
}
function form() { return view().find((n) => n.type === CharacterForm)!.props; }
function start() { hooks.values = []; return vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}'))); }

 describe('RosterEditor actions', () => {
  it('adds an alt for the selected member with no rank picker', async () => {
    start(); await button(`Add alt for ${member.discordName}`)();
    expect(form().showRank).toBe(false);
    await (form().onSubmit as (v: unknown) => Promise<unknown>)(member.alts[0]);
    expect(fetch).toHaveBeenCalledWith('/api/roster', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: member.userId, alt: true, ...member.alts[0] }) }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('edits the selected alt, not the main', async () => {
    start(); await button('Edit Blue Ink')();
    expect(form().showRank).toBe(false);
    await (form().onSubmit as (v: unknown) => Promise<unknown>)(member.alts[0]);
    expect(fetch).toHaveBeenCalledWith('/api/roster/alt-1', expect.objectContaining({ method: 'PATCH' }));
  });

  it.each(['make-main', 'remove'])('asks before %s and sends only after confirmation', async (kind) => {
    start(); await button('Edit Blue Ink')();
    (form()[kind === 'make-main' ? 'onMakeMain' : 'onRemove'] as () => void)();
    expect(fetch).not.toHaveBeenCalled();
    const dialog = view().filter((n) => n.type === Modal).at(-1)!;
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.children).toContain(kind === 'make-main' ? EDITOR.makeMainBody : EDITOR.removeAltBody);
    await button(kind === 'make-main' ? EDITOR.makeMainConfirm : EDITOR.removeConfirm)();
    expect(fetch).toHaveBeenCalledWith(`/api/roster/alt-1${kind === 'make-main' ? '/main' : ''}`, expect.objectContaining({ method: kind === 'make-main' ? 'POST' : 'DELETE' }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each(['You can have up to 8 characters.', 'You already have a character with that name.', 'Set a main first.'])('returns route validation: %s', async (error) => {
    start(); vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error }), { status: 409 }));
    await button(`Add alt for ${member.discordName}`)();
    expect(await (form().onSubmit as (v: unknown) => Promise<unknown>)(member.alts[0])).toBe(error);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows a blocked main removal inside the confirmation, not behind it', async () => {
    start(); vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Make another character the main first.' }), { status: 409 }));
    await button('Edit Red Tape')(); (form().onRemove as () => void)();
    await button(EDITOR.removeConfirm)();
    expect(view().find((n) => n.props.role === 'alert')?.props.children).toBe('Make another character the main first.');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recovers from network failure and does not submit again while busy', async () => {
    start(); let reject!: (reason: Error) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    await button('Edit Blue Ink')(); (form().onMakeMain as () => void)();
    const first = button(EDITOR.makeMainConfirm)();
    await button(EDITOR.makeMainConfirm)(); expect(fetch).toHaveBeenCalledOnce();
    reject(new Error('offline')); await first;
    expect(view().find((n) => n.props.role === 'alert')?.props.children).toBe(SAVE_FAILED);
    expect(view().find((n) => n.props.children === EDITOR.makeMainConfirm)?.props.loading).toBe(false);
  });
});

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
