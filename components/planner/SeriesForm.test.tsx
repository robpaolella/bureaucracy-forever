// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeriesInput } from '@/lib/raid-series-rules';
import { SeriesForm } from './SeriesForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ubrs = { id: 'ubrs', name: 'Upper Blackrock Spire', durationMin: 180 };
const long = { id: 'long', name: 'T'.repeat(60), durationMin: 180 };
const initial: SeriesInput = { templateId: 'ubrs', weekday: 2, startTime: '20:00', durationMin: 180, notes: '', titleAddition: '', postAheadDays: 14, lockMinutesBefore: 120, horizonWeeks: 4, active: true };

let root: Root, host: HTMLDivElement;
const onSubmit = vi.fn(async () => null);
const render = (props: Partial<Parameters<typeof SeriesForm>[0]> = {}) =>
  act(async () => root.render(<SeriesForm templates={[ubrs, long]} initial={initial} submitLabel="Add series" onSubmit={onSubmit} {...props} />));
const box = () => [...host.querySelectorAll('label')].find((l) => l.textContent === 'Title addition')!.parentElement!.querySelector('input') as HTMLInputElement;
const change = (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
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

describe('SeriesForm title addition', () => {
  it('starts with the stored addition on Edit and shows the title every raid gets', async () => {
    await render({ initial: { ...initial, titleAddition: 'Key Run' } });
    expect(box().value).toBe('Key Run');
    expect(host.textContent).toContain('Every raid\'s title reads “Upper Blackrock Spire: Key Run”.');
  });

  it('sends the tidied addition, and none when blank', async () => {
    await render();
    await change(box(), ' Key   Run ');
    await submit();
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ titleAddition: 'Key Run' }));
    await change(box(), '  ');
    await submit();
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ titleAddition: null }));
  });

  it('shows the too-long title under the box and does not submit', async () => {
    await render({ initial: { ...initial, templateId: 'long' } });
    await change(box(), 'x'.repeat(26));
    expect(box().getAttribute('aria-invalid')).toBe('true');
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]')?.textContent).toMatch(/100 characters or fewer/);
  });
});
