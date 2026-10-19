/** A piece of a Discord message body: plain text, or a tag shown as a pill. */
export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'user' | 'role' | 'channel'; label: string };

export const UNKNOWN_USER = '@unknown user';

// <@id>, <@!id>, <@&id>, <#id>, <:name:id>, <a:name:id>. Ids are Discord snowflakes (digits only).
const TAG = /<(?:@(!|&)?(\d+)|#(\d+)|a?:(\w+):\d+)>/g;

/**
 * Split a body into text and tag segments, in order. Anything that is not a well-formed tag stays text,
 * and the result is data only: callers render it as text and elements, never as markup.
 */
export function parseMentions(body: string, users: Record<string, string> = {}): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev?.type === 'text') prev.text += text;
    else out.push({ type: 'text', text });
  };
  for (const m of body.matchAll(TAG)) {
    push(body.slice(last, m.index));
    last = m.index + m[0].length;
    const [, prefix, id, channelId, emoji] = m;
    if (emoji) push(`:${emoji}:`);
    else if (channelId) out.push({ type: 'channel', label: '#channel' });
    else if (prefix === '&') out.push({ type: 'role', label: '@role' });
    else out.push({ type: 'user', label: Object.hasOwn(users, id) ? `@${users[id]}` : UNKNOWN_USER });
  }
  push(body.slice(last));
  return out;
}

/** Ids of the people a body tags, for one lookup. */
export function mentionedUserIds(body: string): string[] {
  return [...body.matchAll(TAG)].flatMap((m) => (m[2] && m[1] !== '&' ? [m[2]] : []));
}
