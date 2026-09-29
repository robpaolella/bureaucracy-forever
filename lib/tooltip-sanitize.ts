/**
 * Wowhead's tooltip HTML is third-party markup. It is cut down to an allowlist before it
 * is stored and again before it is rendered: layout tables, line breaks, bold and spans
 * with Wowhead's quality and money classes. Links become plain spans (they point into
 * Wowhead), and every other tag, attribute, style and comment is dropped.
 */
import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['table', 'tbody', 'tr', 'td', 'th', 'b', 'br', 'span', 'div'],
  allowedAttributes: { '*': ['class'], table: ['width', 'class'] },
  allowedClasses: { '*': ['q', 'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'whtt-*', 'moneygold', 'moneysilver', 'moneycopper', 'indent'] },
  allowedSchemes: [],
  transformTags: { a: 'span' },
  // Drop the contents of these outright rather than keeping their text.
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe', 'object', 'embed', 'svg', 'math'],
  disallowedTagsMode: 'discard',
};

export function sanitizeTooltip(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
