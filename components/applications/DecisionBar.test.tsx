// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionBar } from './DecisionBar';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/components/ui', async (orig) => ({ ...(await orig<typeof import('@/components/ui')>()), useToast: () => mocks.toast }));

const messages = { raider: 'Raider text', social: 'Social text', declined: 'Standard decline for Thrall' };
let root: Root, host: HTMLDivElement, fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const render = (path: 'raider' | 'social' = 'raider') => act(async () => root.render(<DecisionBar id="app" name="thrall" path={path} pending messages={messages} />));
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement;
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });
const type = (el: HTMLTextAreaElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const radio = (label: string) => [...host.querySelectorAll('label')].find((l) => l.textContent === label)!.querySelector('input') as HTMLInputElement;
const sent = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
const failWith = (status: number, error: string) => fetchMock.mockResolvedValue(new Response(JSON.stringify({ error }), { status }));

describe('Decline window', () => {
  beforeEach(async () => { await render(); await click(button('Decline')); });

  it('shows the standard message and sends it by default', async () => {
    expect(host.textContent).toContain('Standard decline for Thrall');
    await click(button('Decline and send the standard message'));
    expect(sent()).toEqual({ status: 'declined', message: { kind: 'standard' } });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('sends no message', async () => {
    await click(radio('Send no message'));
    await click(button('Decline with no message'));
    expect(sent()).toEqual({ status: 'declined', message: { kind: 'none' } });
  });

  it('sends the custom message, trimmed', async () => {
    await click(radio('Write my own message'));
    await type(host.querySelector('textarea')!, '  Not this time.  ');
    await click(button('Decline and send my message'));
    expect(sent()).toEqual({ status: 'declined', message: { kind: 'custom', text: 'Not this time.' } });
  });

  it.each([['', 'Write the message first.'], ['   \n ', 'Write the message first.'], ['x'.repeat(2001), 'Keep the message to 2,000 characters.'], ['😀'.repeat(2001), 'Keep the message to 2,000 characters.']])('refuses %#', async (text, reason) => {
    await click(radio('Write my own message'));
    await type(host.querySelector('textarea')!, text);
    await click(button('Decline and send my message'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain(reason);
  });

  it.each([['x'.repeat(2000)], ['😀'.repeat(2000)]])('accepts exactly 2,000 characters %#', async (text) => {
    await click(radio('Write my own message'));
    await type(host.querySelector('textarea')!, text);
    expect(host.textContent).toContain('2,000 of 2,000 characters');
    await click(button('Decline and send my message'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the window and the typed text on a conflict, and refreshes only when closed', async () => {
    failWith(409, 'This application was already decided.');
    await click(radio('Write my own message'));
    await type(host.querySelector('textarea')!, 'My words');
    await click(button('Decline and send my message'));
    expect(host.textContent).toContain('This application was already decided. Close this window to see where it stands.');
    expect(host.querySelector('textarea')!.value).toBe('My words');
    expect(mocks.refresh).not.toHaveBeenCalled();
    await click(button('Not yet'));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the window on a 400 and on a network failure', async () => {
    failWith(400, 'Keep the message to 2,000 characters.');
    await click(button('Decline and send the standard message'));
    expect(host.textContent).toContain('Keep the message to 2,000 characters.');
    fetchMock.mockRejectedValue(new Error('offline'));
    await click(button('Decline and send the standard message'));
    expect(host.textContent).toContain("Couldn't save that");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('Accept window', () => {
  it('on the raider path, Confirm accepts as raider', async () => {
    await render('raider');
    await click(button('Accept'));
    expect(host.textContent).toContain('Would you like to accept this member as a Raider and begin their trial?');
    expect(host.textContent).not.toMatch(/short chat/i);
    expect(host.textContent).toContain('Raider text');
    expect(host.textContent).toContain('Social text');
    await click(button('Confirm'));
    expect(sent()).toEqual({ status: 'accepted', acceptAs: 'raider' });
  });

  it('on the raider path, Accept as Social accepts as social', async () => {
    await render('raider');
    await click(button('Accept'));
    await click(button('Accept as Social'));
    expect(sent()).toEqual({ status: 'accepted', acceptAs: 'social' });
  });

  it('on the social path, one confirm accepts as social with no trial copy', async () => {
    await render('social');
    await click(button('Accept'));
    expect(host.textContent).toContain('Social text');
    expect(host.textContent).not.toContain('Would you like');
    expect(host.textContent).not.toMatch(/two-week/i);
    await click(button('Accept the application'));
    expect(sent()).toEqual({ status: 'accepted', acceptAs: 'social' });
  });

  it('keeps the window on a conflict', async () => {
    failWith(409, 'This application was already decided.');
    await render('raider');
    await click(button('Accept'));
    await click(button('Confirm'));
    expect(host.textContent).toContain('Close this window');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('Move to social', () => {
  beforeEach(async () => { await render('raider'); });

  it('shows an error toast and refreshes on a conflict', async () => {
    failWith(409, 'This application was already decided.');
    await click(button('Move to social'));
    expect(mocks.toast).toHaveBeenCalledWith({ tone: 'stop', title: 'This application was already decided.' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast on a network error, without refreshing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await click(button('Move to social'));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'stop' }));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('Decline intro', () => {
  it.each(['Write my own message', 'Send no message', 'Send the standard message'])('promises nothing for %s', async (choice) => {
    await render();
    await click(button('Decline'));
    const label = [...host.querySelectorAll('label')].find((l) => l.textContent === choice);
    if (label) await click(label.querySelector('input')!);
    const intro = host.querySelector('dialog p')!.textContent!;
    expect(intro).not.toMatch(/told the answer is no|without the reasons/);
    expect(intro).toContain('Officer notes stay private.');
  });
});
