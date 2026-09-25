/** Small text helpers shared by server and client components. */

/**
 * Two-letter avatar initials. First two letters of the name; a Discord avatar image
 * will replace these once auth lands. (The artboards hand-pick letters such as "LL"
 * for Ledgerline, which no rule derives.)
 */
export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
