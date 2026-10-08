import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { CharacterForm } from './CharacterForm';
import { AltsToggle } from './AltsToggle';
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
      return [hooks.values[index], (value: unknown) => { hooks.values![index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(hooks.values![index]) : value; }];
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
function view(members: EditorMember[] = [member]) { hooks.index = 0; return nodes(RosterEditor({ members })); }
function button(label: string) {
  const node = view().find((n) => n.props['aria-label'] === label || n.props.children === label);
  expect(node).toBeDefined();
  return node!.props.onClick as () => Promise<void>;
}
function form() { return view().find((n) => n.type === CharacterForm)!.props; }
function openAlts() { (view().find((n) => n.type === AltsToggle)!.props.onToggle as () => void)(); }
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
    start(); openAlts(); await button('Edit Blue Ink')();
    expect(form().showRank).toBe(false);
    await (form().onSubmit as (v: unknown) => Promise<unknown>)(member.alts[0]);
    expect(fetch).toHaveBeenCalledWith('/api/roster/alt-1', expect.objectContaining({ method: 'PATCH' }));
  });

  it.each(['make-main', 'remove'])('asks before %s and sends only after confirmation', async (kind) => {
    start(); openAlts(); await button('Edit Blue Ink')();
    (form()[kind === 'make-main' ? 'onMakeMain' : 'onRemove'] as () => void)();
    expect(fetch).not.toHaveBeenCalled();
    const dialog = view().filter((n) => n.type === Modal).at(-1)!;
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.title).toBe(kind === 'make-main' ? EDITOR.makeMainTitle('Blue Ink') : EDITOR.removeTitle);
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
    openAlts(); await button('Edit Blue Ink')(); (form().onMakeMain as () => void)();
    const first = button(EDITOR.makeMainConfirm)();
    await button(EDITOR.makeMainConfirm)(); expect(fetch).toHaveBeenCalledOnce();
    reject(new Error('offline')); await first;
    expect(view().find((n) => n.props.role === 'alert')?.props.children).toBe(SAVE_FAILED);
    expect(view().find((n) => n.props.children === EDITOR.makeMainConfirm)?.props.loading).toBe(false);
  });
});

describe('RosterEditor', () => {
  it('keeps alts collapsed by default, then exposes the existing edit control when toggled', () => {
    start();
    expect(render()).not.toContain('Blue Ink · Mage · Frost · Ranged');
    const toggle = view().find((n) => n.type === AltsToggle)!;
    expect(toggle.props.count).toBe(1);
    expect((toggle.props.label as (count: number) => string)(1)).toBe('Alts 1');
    expect(toggle.props.expanded).toBe(false);
    expect(toggle.props.controlsId).toBe('officer-alts-member-1');
    expect(toggle.props.memberName).toBe(member.discordName);

    (toggle.props.onToggle as () => void)();
    expect(view().find((n) => n.props.id === 'officer-alts-member-1')).toBeDefined();
    expect(view().find((n) => n.props['aria-label'] === `${EDITOR.edit} Blue Ink`)).toBeDefined();
    expect(view().find((n) => n.type === AltsToggle)!.props.expanded).toBe(true);
  });

  it('uses a unique disclosure for every member with alts, and none for members without them', () => {
    const second: EditorMember = { ...member, userId: 'member-2', discordName: 'Addendum', alts: [{ ...member.alts[0], id: 'alt-2', name: 'Ink Blot' }] };
    const noAlts: EditorMember = { ...member, userId: 'member-3', discordName: 'Quorum', alts: [] };
    const html = render([member, second, noAlts]);

    expect(html).toContain('aria-controls="officer-alts-member-1"');
    expect(html).toContain('aria-controls="officer-alts-member-2"');
    expect(html).not.toContain('officer-alts-member-3');
  });

  it('opens only alt-name search matches, and a manual collapse wins until the search clears', () => {
    start();
    const input = view().find((n) => n.type === 'input')!;
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Blue' } });
    let toggle = view().find((n) => n.type === AltsToggle)!;
    expect(toggle.props.expanded).toBe(true);

    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '' } });
    expect(view().find((n) => n.type === AltsToggle)!.props.expanded).toBe(false);

    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Blue' } });
    toggle = view().find((n) => n.type === AltsToggle)!;
    expect(toggle.props.expanded).toBe(true);
    (toggle.props.onToggle as () => void)();
    expect(view().find((n) => n.type === AltsToggle)!.props.expanded).toBe(false);

    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Paperclip' } });
    expect(view().find((n) => n.type === AltsToggle)!.props.expanded).toBe(false);
  });

  it('adds an alt control only for members with a main', () => {
    expect(render()).toContain(`aria-label="${EDITOR.addAlt} for ${member.discordName}"`);
    expect(render([{ ...member, main: null, alts: [] }])).not.toContain(EDITOR.addAlt);
  });

  it('keeps plain-language copy ready for the main-change confirmation', () => {
    expect(EDITOR.makeMainTitle('Blue Ink')).toBe('Make Blue Ink the main?');
    expect(EDITOR.makeMainBody).toBe('The current main becomes an alt. Past raids keep the character they recorded.');
    expect(EDITOR.makeMainConfirm).toBe(EDITOR.makeMain);
  });
});
