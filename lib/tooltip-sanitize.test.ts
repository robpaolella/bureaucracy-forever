import { describe, expect, it } from 'vitest';
import { sanitizeTooltip } from './tooltip-sanitize';

// Trimmed from https://nether.wowhead.com/classic/tooltip/item/17076.
const WOWHEAD =
  '<table><tr><td><!--nstart--><b class="q4">Bonereaver\'s Edge</b><!--nend--><span class="q"><br>Item Level <!--ilvl-->77</span><br>Binds when picked up<table width="100%"><tr><td>Two-Hand</td><th><span class="q1">Sword</span></th></tr></table>' +
  '<span id="useText1" class="q2">Chance on hit: <a href="/classic/spell=21153/bonereavers-edge" class="q2">Your attacks ignore 700 armor.</a></span>' +
  '<div class="whtt-sellprice">Sell Price: <span class="moneygold">19</span></div></td></tr></table>';

describe('sanitizeTooltip', () => {
  it('keeps the layout, quality classes and text of a real tooltip', () => {
    const out = sanitizeTooltip(WOWHEAD);
    expect(out).toContain('<b class="q4">Bonereaver\'s Edge</b>');
    expect(out).toContain('<table width="100%">');
    expect(out).toContain('<th><span class="q1">Sword</span></th>');
    expect(out).toContain('<div class="whtt-sellprice">Sell Price: <span class="moneygold">19</span></div>');
  });

  it('turns links into spans and drops ids and comments', () => {
    const out = sanitizeTooltip(WOWHEAD);
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
    expect(out).not.toContain('id=');
    expect(out).not.toContain('<!--');
    expect(out).toContain('<span class="q2">Your attacks ignore 700 armor.</span>');
  });

  it.each([
    ['<script>alert(1)</script><b>ok</b>', '<b>ok</b>'],
    ['<img src=x onerror="alert(1)">', ''],
    ['<span onclick="alert(1)" style="color:red" class="q4 evil">x</span>', '<span class="q4">x</span>'],
    ['<a href="javascript:alert(1)">x</a>', '<span>x</span>'],
    ['<iframe src="https://evil.test"></iframe><svg><script>1</script></svg>', ''],
    ['<style>body{display:none}</style>text', 'text'],
    ['<table width="100%" onmouseover="x" background="y"><tr><td>a</td></tr></table>', '<table width="100%"><tr><td>a</td></tr></table>'],
  ])('neutralises %s', (input, expected) => {
    expect(sanitizeTooltip(input)).toBe(expected);
  });

  it('is idempotent, so render can sanitize stored HTML again', () => {
    const once = sanitizeTooltip(WOWHEAD);
    expect(sanitizeTooltip(once)).toBe(once);
  });
});
