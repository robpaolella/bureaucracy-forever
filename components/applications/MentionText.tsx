import { parseMentions } from '@/lib/discord-mentions';
import { roleColors } from '@/lib/mention-colors';
import type { Mentions } from '@/lib/mentions-input';

type Props = { body: string; users?: Record<string, string>; mentions?: Mentions | null };

const PILL = 'rounded-sm px-1';
const ACCENT = `${PILL} border border-teal-line bg-teal-wash text-teal-text`;

/**
 * A note or message body with Discord tags shown as pills. Names the bot stored with the row win over
 * `users`, the site's own people; anything missing falls back to the generic label. Text and elements only,
 * never markup; a role colour is only ever a computed hex value in an inline style.
 */
export function MentionText({ body, users, mentions }: Props) {
  const names = { ...users, ...Object.fromEntries(Object.entries(mentions?.users ?? {}).map(([id, u]) => [id, u.name])) };
  return (
    <>
      {parseMentions(body, names, { roles: mentions?.roles, channels: mentions?.channels }).map((s, i) => {
        if (s.type === 'text') return s.text;
        const colors = s.type === 'role' ? roleColors(s.color) : null;
        return colors ? (
          <span key={i} className={PILL} style={{ color: colors.text, backgroundColor: colors.background }}>
            {s.label}
          </span>
        ) : (
          <span key={i} className={ACCENT}>
            {s.label}
          </span>
        );
      })}
    </>
  );
}
