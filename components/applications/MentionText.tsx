import { parseMentions } from '@/lib/discord-mentions';

type Props = { body: string; users?: Record<string, string> };

/** A note or message body with Discord tags shown as pills. Text and elements only, never markup. */
export function MentionText({ body, users }: Props) {
  return (
    <>
      {parseMentions(body, users).map((s, i) =>
        s.type === 'text' ? (
          s.text
        ) : (
          <span key={i} className="rounded-sm border border-teal-line bg-teal-wash px-1 text-teal-text">
            {s.label}
          </span>
        ),
      )}
    </>
  );
}
