// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyRaidInput, type RaidTemplateOption } from '@/lib/raids';
import { RaidForm } from './RaidForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mc: RaidTemplateOption = { id: 'mc', name: 'Molten Core', durationMin: 240, requirements: { tank: 3, healer: 9, melee: 10, ranged: 13 } };
const short: RaidTemplateOption = { id: 'zg', name: 'Zul’Gurub', durationMin: 75, requirements: { tank: 2, healer: 4, melee: 6, ranged: 8 } };
const initial = emptyRaidInput({}, new Date('2099-01-01T12:00:00Z'));

let root: Root, host: HTMLDivElement;
const onSubmit = vi.fn(async () => null);
const render = (templates: RaidTemplateOption[], props: Partial<Parameters<typeof RaidForm>[0]> = {}) =>
  act(async () => root.render(<RaidForm initial={initial} templates={templates} submitLabel="Schedule" onSubmit={onSubmit} onCancel={() => {}} {...props} />));
const field = (label: string) => [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!.parentElement!.querySelector('select, input') as HTMLSelectElement | HTMLInputElement;
const change = (el: HTMLSelectElement | HTMLInputElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
const needed = (role: string) => Number((host.querySelector(`input[type=number][id$="-${role}"]`) as HTMLInputElement).value);
const submit = () => act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  onSubmit.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('RaidForm template', () => {
  it('fills Length and Needed from the picked template, and replaces them on another pick', async () => {
    await render([mc, short]);
    await change(field('Raid'), 'mc');
    expect((field('Length') as HTMLSelectElement).value).toBe('240');
    expect([needed('tank'), needed('healer'), needed('melee'), needed('ranged')]).toEqual([3, 9, 10, 13]);
    await change(field('Raid'), 'zg');
    expect((field('Length') as HTMLSelectElement).value).toBe('75');
    expect(needed('tank')).toBe(2);
  });

  it('shows a 75-minute template length with its label', async () => {
    await render([short]);
    await change(field('Raid'), 'zg');
    const option = [...(field('Length') as HTMLSelectElement).options].find((o) => o.value === '75');
    expect(option?.textContent).toBe('1 hour 15 minutes');
  });

  it('sends what the officer changed after picking', async () => {
    await render([mc]);
    await change(field('Raid'), 'mc');
    await change(field('Length'), '300');
    await change(host.querySelector('input[type=number][id$="-tank"]') as HTMLInputElement, '4');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'mc', durationMin: 300, requirements: { tank: 4, healer: 9, melee: 10, ranged: 13 } }));
  });

  it('will not submit without a template', async () => {
    await render([mc]);
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]')?.textContent).toBe('Pick a raid template.');
  });

  it('shows the template but locks it on an event that has one', async () => {
    await render([mc], { initial: { ...initial, templateId: 'mc' }, templateLocked: true });
    expect(field('Raid').disabled).toBe(true);
    expect((field('Raid') as HTMLSelectElement).value).toBe('mc');
  });

  it('with no active templates, says one is needed, links to raid management and cannot submit', async () => {
    await render([]);
    expect(host.textContent).toContain('Set up a raid template before you schedule a raid.');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/officers/raids');
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Schedule')!;
    expect(button.disabled).toBe(true);
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('RaidForm Reserves allowed switch', () => {
  const sw = () => host.querySelector<HTMLButtonElement>('button[role=switch]');
  const ready = { ...initial, templateId: 'mc' };

  it('shows while loot is on, on by default when scheduling', async () => {
    await render([mc], { lootOn: true });
    expect(sw()?.getAttribute('aria-checked')).toBe('true');
    expect(host.textContent).toContain('Reserves allowed');
  });

  it('shows the stored value on Edit', async () => {
    await render([mc], { lootOn: true, initial: { ...ready, reservesAllowed: false } });
    expect(sw()?.getAttribute('aria-checked')).toBe('false');
  });

  it('sends what the officer chose', async () => {
    await render([mc], { lootOn: true, initial: ready });
    await act(async () => sw()!.click());
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ reservesAllowed: false }));
  });

  it('is hidden and not sent while loot is off', async () => {
    await render([mc], { initial: { ...ready, reservesAllowed: false } });
    expect(sw()).toBeNull();
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((onSubmit.mock.calls as unknown[][])[0][0]).not.toHaveProperty('reservesAllowed');
  });
});
