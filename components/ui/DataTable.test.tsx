import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';

const columns = [{ key: 'name', header: 'Name', render: (r: string) => r }, { key: 'value', header: 'Value', render: () => '1', numeric: true }];
const rows = ['First', 'Second'];
const props = { columns, rows, rowKey: (r: string) => r };

describe('DataTable optional sub-rows', () => {
  it('keeps the existing markup, striping and cells unchanged by default', () => {
    const html = renderToStaticMarkup(<DataTable {...props} />);
    expect(html).toBe(renderToStaticMarkup(<DataTable {...props} renderSubRow={undefined} />));
    expect(html.match(/<tr\b/g)).toHaveLength(3);
    expect(html.match(/<td\b/g)).toHaveLength(4);
    expect(html.match(/transition-colors duration-\[120ms\] even:bg-ink-850 hover:bg-ink-850/g)).toHaveLength(2);
    expect(html.match(/h-11 py-1.5 text-right tabular/g)).toHaveLength(2);
    expect(html).not.toContain('colSpan');
  });

  it('renders details only when supplied, spanning every column, without counting them in groups', () => {
    const html = renderToStaticMarkup(<DataTable {...props} groups={[{ key: 'g', label: 'Members', rows }]} renderSubRow={(r) => r === 'First' ? <ul><li>Alt</li></ul> : null} />);
    expect(html.match(/<tr\b/g)).toHaveLength(5);
    expect(html).toContain('colSpan="2" class="border-b border-line-faint"><ul><li>Alt</li></ul>');
    expect(html).toContain('· 2</span>');
    expect(html).toContain('duration-[120ms] bg-ink-850 hover:bg-ink-850');
  });

  it('does not render an empty detail row when the detail callback returns null', () => {
    const html = renderToStaticMarkup(<DataTable {...props} renderSubRow={() => null} />);
    expect(html.match(/<tr\b/g)).toHaveLength(3);
    expect(html.match(/<td\b/g)).toHaveLength(4);
  });
});
