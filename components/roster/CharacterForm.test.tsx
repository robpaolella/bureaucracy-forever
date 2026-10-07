import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EDITOR } from '@/content/roster-editor';
import { CharacterForm } from './CharacterForm';

const initial = { name: 'Red Tape', wowClass: 'warrior' as const, spec: 'Protection', role: 'tank' as const, rank: 'raider' as const };
const submit = vi.fn(async () => null);

function render(props: Partial<Parameters<typeof CharacterForm>[0]> = {}) {
  return renderToStaticMarkup(<CharacterForm initial={initial} submitLabel={EDITOR.save} onSubmit={submit} onCancel={() => {}} {...props} />);
}

describe('CharacterForm', () => {
  it('hides the rank picker for an alt', () => {
    expect(render({ showRank: false })).not.toContain(`>${EDITOR.rank}<`);
  });

  it('offers promotion and removal when editing an alt', () => {
    const html = render({ showRank: false, onMakeMain: () => {}, onRemove: () => {} });
    expect(html).toContain(EDITOR.makeMain);
    expect(html).toContain(EDITOR.remove);
  });

  it('keeps main-character rank editing available', () => {
    expect(render()).toContain(`>${EDITOR.rank}<`);
  });
});
