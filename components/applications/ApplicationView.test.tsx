// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationDetail, NoteEntry } from '@/lib/applications-data';
import { ApplicationView } from './ApplicationView';

vi.mock('server-only', () => ({}));
vi.mock('./InterviewCard', () => ({ InterviewCard: () => null }));
vi.mock('./DecisionBar', () => ({ DecisionBar: () => null }));
vi.mock('./NoteComposer', () => ({ NoteComposer: () => null }));

type Msg = Extract<NoteEntry, { kind: 'message' }>;
const msg = (o: Partial<Msg>): Msg => ({ kind: 'message', id: 'm', author: 'Thrall', authorClass: 'shaman', body: 'hello', createdAt: '2026-10-12T01:00:00.000Z', direction: 'from', marker: null, attachmentCount: 0, attachmentUrl: null, ...o });
const base: ApplicationDetail = {
  id: 'app', path: 'raider', status: 'pending', character: 'Thrall', wowClass: 'shaman', spec: 'Enhancement', discordName: 'thrall', createdAt: '2026-10-12T00:00:00.000Z', unread: false,
  discordId: 'd1', logsUrl: null, answers: {}, decidedAt: null, decidedBy: null, discordThreadId: null, interview: null, notes: [], mentionUsers: {},
};
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (notes: NoteEntry[]) => { await act(async () => root.render(<ApplicationView app={{ ...base, notes }} now="2026-10-13T00:00:00.000Z" />)); return host.textContent ?? ''; };

describe('ApplicationView notes and messages', () => {
  it('shows tags as pills with no raw codes left', async () => {
    await act(async () => root.render(<ApplicationView app={{ ...base, mentionUsers: { '111': 'Ledgerline' }, notes: [msg({ body: 'cc <@111> <@&5> <@999> <#7> <:wave:8>' })] }} now="2026-10-13T00:00:00.000Z" />));
    const pills = [...host.querySelectorAll('p span.bg-teal-wash')].map((e) => e.textContent);
    expect(pills).toEqual(['@Ledgerline', '@role', '@unknown user', '#channel']);
    expect(host.textContent).toContain(':wave:');
    expect(host.textContent).not.toContain('<@');
  });


  it('uses the new heading and line', async () => {
    const text = await render([]);
    expect(text).toContain('Notes and messages');
    expect(text).toContain('Notes are for officers only. Rows marked DM went to or came from the applicant.');
    expect(text).toContain('No notes yet.');
  });

  it('labels each direction with the applicant name', async () => {
    const text = await render([msg({ id: '1', direction: 'to', author: 'Ledgerline' }), msg({ id: '2' })]);
    expect(text).toContain('DM to Thrall');
    expect(text).toContain('DM from Thrall');
  });

  it.each([
    [{ marker: 'edited' as const }, 'edited'],
    [{ marker: 'deleted' as const }, 'deleted by Thrall'],
    [{ marker: 'not-delivered' as const, direction: 'to' as const }, 'Not delivered'],
    [{ marker: 'not-sent' as const, direction: 'to' as const }, 'Not sent'],
  ])('shows %j as "%s" and keeps the text', async (over, label) => {
    const text = await render([msg({ ...over, body: 'kept text' })]);
    expect(text).toContain(label);
    expect(text).toContain('kept text');
  });

  it('shows the whole of a long message', async () => {
    const long = 'word '.repeat(2000).trim();
    expect(await render([msg({ body: long })])).toContain(long);
  });

  it('links the attachment note to its Discord copy when there is one', async () => {
    await render([msg({ attachmentCount: 2, attachmentUrl: 'https://discord.com/channels/g/c/m' })]);
    const a = host.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://discord.com/channels/g/c/m');
    expect(a?.textContent).toContain('2 attachments, open it in Discord');
  });

  it('shows the attachment note without a link when there is no copy', async () => {
    const text = await render([msg({ attachmentCount: 1 })]);
    expect(text).toContain('1 attachment, open it in Discord');
    expect(host.querySelector('a')).toBeNull();
  });

  it('still shows a note with its source badge and edited marker', async () => {
    const text = await render([{ kind: 'note', id: 'n', author: 'Redtape', authorClass: null, body: 'a note', createdAt: '2026-10-12T02:00:00.000Z', source: 'discord', discordMessageId: null, editedAt: '2026-10-12T03:00:00.000Z' }]);
    expect(text).toContain('via Discord');
    expect(text).toContain('edited');
  });
});
