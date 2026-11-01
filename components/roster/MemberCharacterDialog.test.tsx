import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { CharacterForm } from './CharacterForm';
import { MemberCharacterDialog, type MemberCharacter } from './MemberCharacterDialog';
import { Modal, Toast } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
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
  it('labels the main and lets the member edit the main and the alts', () => {
    const html = render();
    expect(html).toContain('Red Tape');
    expect(html).toContain(MEMBER_EDITOR.main);
    expect(html).toContain('aria-label="Edit Blue Ink"');
    expect(html).toContain('aria-label="Edit Red Tape"');
  });

  it('offers Add main, not the Discord note, without a main, and posts main: true', async () => {
    expect(render([alt])).toContain(MEMBER_EDITOR.addMain);
    expect(render([alt])).not.toContain('Discord');
    hooks.values = [];
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...main, class: 'WARRIOR', raidRole: 'TANK' }])));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters, [])();
    button(MEMBER_EDITOR.addMain, [])();
    const form = view([]).find((node) => node.type === CharacterForm)!;
    expect(form.props.submitLabel).toBe(MEMBER_EDITOR.addMain);
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...main, rank: 'raider' })).toBeNull();
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ main: true, name: 'Red Tape' });
    expect(view([]).find((node) => node.type === Toast)?.props.toast).toEqual({ tone: 'ok', title: 'Added Red Tape to the roster' });
    expect(view([]).some((node) => node.props['aria-label'] === 'Edit Red Tape')).toBe(true);
  });

  it('edits the main with the class hint, no Remove and no Make main, via PATCH', async () => {
    hooks.values = [];
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...main, class: 'WARRIOR', raidRole: 'TANK', spec: 'Arms' }])));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Red Tape')();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(form.props.classHint).toBe(MEMBER_EDITOR.mainClassHint);
    expect(form.props.onRemove).toBeUndefined();
    expect(form.props.onMakeMain).toBeUndefined();
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...main, rank: 'raider' })).toBeNull();
    expect(request).toHaveBeenNthCalledWith(1, '/api/me/characters/main', expect.objectContaining({ method: 'PATCH' }));
    expect(view().find((node) => node.type === Toast)?.props.toast).toEqual({ tone: 'ok', title: 'Saved Red Tape' });
  });

  it('asks before making an alt the main, and Keep it changes nothing', async () => {
    hooks.values = [];
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(form.props.classHint).toBeUndefined();
    (form.props.onMakeMain as () => void)();
    const dialog = view().filter((node) => node.type === Modal).at(-1)!;
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.title).toBe(MEMBER_EDITOR.makeMainTitle('Blue Ink'));
    expect(dialog.props.children).toContain(MEMBER_EDITOR.makeMainBody);
    button(MEMBER_EDITOR.keep)();
    expect(view().filter((node) => node.type === Modal).at(-1)!.props.open).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('makes the alt the main, reorders the list and toasts', async () => {
    hooks.values = [];
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { ...main, isMain: false, class: 'WARRIOR', raidRole: 'TANK' },
        { ...alt, isMain: true, class: 'MAGE', raidRole: 'RANGED' },
      ])));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    const form = view().find((node) => node.type === CharacterForm)!;
    (form.props.onMakeMain as () => void)();
    button(MEMBER_EDITOR.makeMainConfirm)();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenNthCalledWith(1, '/api/me/characters/alt/main', expect.objectContaining({ method: 'POST' }));
    await vi.waitFor(() => expect(view().find((node) => node.type === Toast)?.props.toast).toEqual({ tone: 'ok', title: 'Blue Ink is now your main' }));
    const names = view().filter((node) => node.props.style && typeof node.props.children === 'string').map((node) => node.props.children);
    expect(names).toEqual(['Blue Ink', 'Red Tape']);
  });

  it('shows the refusal when making a main fails', async () => {
    hooks.values = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Only guild members can change characters.' }), { status: 403 })));
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    (view().find((node) => node.type === CharacterForm)!.props.onMakeMain as () => void)();
    button(MEMBER_EDITOR.makeMainConfirm)();
    await vi.waitFor(() => expect(view().some((node) => node.props.role === 'alert' && node.props.children !== undefined)).toBe(true));
    expect(view().find((node) => node.props.role === 'alert')?.props.children).toBe('Only guild members can change characters.');
  });

  it('hides the old list and still refreshes the page when a change succeeds but the reload fails', async () => {
    hooks.values = [];
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    (view().find((node) => node.type === CharacterForm)!.props.onMakeMain as () => void)();
    button(MEMBER_EDITOR.makeMainConfirm)();
    await vi.waitFor(() => expect(view().find((node) => node.type === Toast)?.props.toast).toEqual({ tone: 'ok', title: 'Blue Ink is now your main' }));
    expect(refresh).toHaveBeenCalled();
    expect(view().some((node) => node.props['aria-label'] === 'Edit Red Tape')).toBe(false);
    expect(view().some((node) => node.props.children === MEMBER_EDITOR.reload)).toBe(true);
  });

  it('shows the entry point only on the viewer’s own row', () => {
    const rows: RosterRow[] = [
      { id: 'viewer', name: 'Redtape', character: 'Red Tape', alts: [], wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'raider', attendance: null, joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'other', name: 'Ledgerline', character: 'Blue Ink', alts: [], wowClass: 'mage', spec: 'Frost', role: 'ranged', rank: 'officer', attendance: null, joinedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const html = renderToStaticMarkup(<RosterTable rows={rows} viewer={{ id: 'viewer', rank: 'raider', characters: [main] }} />);
    expect(html.match(/aria-label="Manage characters"/g)).toHaveLength(2); // One action in each responsive rendering, never on the other row.
  });

  it.each([['You can have up to 8 characters.', 409], ['You already have a character with that name.', 409], ['Only guild members can change characters.', 403]] as const)('returns the route’s message for the form: %s', async (error, status) => {
    hooks.values = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status })));
    button(MEMBER_EDITOR.manageCharacters)();
    button(MEMBER_EDITOR.addAlt)();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' })).toBe(error);
  });

  it.each([401, 500, 'network'] as const)('shows a plain save failure for %s', async (failure) => {
    hooks.values = [];
    const request = vi.fn();
    if (failure === 'network') request.mockRejectedValue(new Error('Network unavailable'));
    else request.mockResolvedValue(new Response(JSON.stringify({ error: 'Internal route wording' }), { status: failure }));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' })).toBe(SAVE_FAILED);
  });

  it('refreshes the list and shows a plain failure when an alt was already removed', async () => {
    hooks.values = [];
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Character not found' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...main, class: 'WARRIOR', raidRole: 'TANK' }])));
    vi.stubGlobal('fetch', request);
    button(MEMBER_EDITOR.manageCharacters)();
    button('Edit Blue Ink')();
    const form = view().find((node) => node.type === CharacterForm)!;
    expect(await (form.props.onSubmit as (value: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' })).toBeNull();
    expect(request).toHaveBeenNthCalledWith(2, '/api/me/characters', expect.objectContaining({ method: 'GET' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(view().some((node) => node.props['aria-label'] === 'Edit Blue Ink')).toBe(false);
    expect(view().find((node) => node.type === Toast)?.props.toast).toEqual({ tone: 'stop', title: SAVE_FAILED });
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

  describe('when the list cannot reload', () => {
    const gone = () => new Response(JSON.stringify({ error: 'Character not found' }), { status: 404 });
    const ok = () => new Response('{}');
    const down = () => new Response('{}', { status: 500 });
    const submit = async (label: string, value: MemberCharacter | null) => {
      button(MEMBER_EDITOR.manageCharacters)();
      button(label)();
      const form = view().find((node) => node.type === CharacterForm)!;
      await (form.props.onSubmit as (v: unknown) => Promise<unknown>)({ ...(value ?? alt), rank: 'raider' });
    };
    const confirmFlow = (prop: 'onRemove' | 'onMakeMain', confirmLabel: string) => {
      button(MEMBER_EDITOR.manageCharacters)();
      button('Edit Blue Ink')();
      (view().find((node) => node.type === CharacterForm)!.props[prop] as () => void)();
      button(confirmLabel)();
    };
    const said = (text: string) => view().some((node) => node.props.children === text);
    const toast = () => view().find((node) => node.type === Toast)?.props.toast;

    it.each([
      ['edit', () => submit('Edit Blue Ink', alt)],
      ['add', async () => { button(MEMBER_EDITOR.manageCharacters)(); button(MEMBER_EDITOR.addAlt)(); await (view().find((n) => n.type === CharacterForm)!.props.onSubmit as (v: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' }); }],
    ])('%s: a saved change with a failed reload says it was saved', async (_name, act) => {
      hooks.values = [];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(down()));
      await act();
      expect(said(MEMBER_EDITOR.staleBody)).toBe(true);
      expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(false);
    });

    it.each([
      ['edit', () => submit('Edit Blue Ink', alt)],
      ['add', async () => { button(MEMBER_EDITOR.manageCharacters)(); button(MEMBER_EDITOR.addAlt)(); await (view().find((n) => n.type === CharacterForm)!.props.onSubmit as (v: unknown) => Promise<unknown>)({ ...alt, rank: 'raider' }); }],
    ])('%s: a failed change with a failed reload claims nothing was saved', async (_name, act) => {
      hooks.values = [];
      // The add route never answers 404 in practice, but the code path is shared.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(gone()).mockResolvedValueOnce(down()));
      await act();
      expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(true);
      expect(said(MEMBER_EDITOR.staleBody)).toBe(false);
      expect(toast()).toEqual({ tone: 'stop', title: SAVE_FAILED });
    });

    it.each([
      ['remove', 'onRemove', MEMBER_EDITOR.removeConfirm],
      ['make main', 'onMakeMain', MEMBER_EDITOR.makeMainConfirm],
    ] as const)('%s: saved + failed reload says saved; failed + failed reload does not', async (_name, prop, label) => {
      hooks.values = [];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(down()));
      confirmFlow(prop, label);
      await vi.waitFor(() => expect(said(MEMBER_EDITOR.staleBody)).toBe(true));
      expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(false);

      hooks.values = [];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(gone()).mockResolvedValueOnce(down()));
      confirmFlow(prop, label);
      await vi.waitFor(() => expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(true));
      expect(said(MEMBER_EDITOR.staleBody)).toBe(false);
    });

    it('keeps the neutral message when Reload list fails again, and clears it on success', async () => {
      hooks.values = [];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(gone()).mockResolvedValueOnce(down()).mockResolvedValueOnce(down()));
      await submit('Edit Blue Ink', alt);
      button(MEMBER_EDITOR.reload)();
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
      expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(true);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ ...main, class: 'WARRIOR', raidRole: 'TANK' }]))));
      button(MEMBER_EDITOR.reload)();
      await vi.waitFor(() => expect(said(MEMBER_EDITOR.staleFailedBody)).toBe(false));
    });
  });
});
