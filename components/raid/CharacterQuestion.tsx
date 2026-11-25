'use client';

import { useCallback, useId, useState, type ReactNode } from 'react';
import type { CharacterChoice } from '@/components/calendar/useSignup';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, ChoiceGroup, ClassAvatar, Modal } from '@/components/ui';
import { CHARACTER_QUESTION } from '@/content/raid';
import { GUILD_TIMEZONE } from '@/lib/config';
import { CLASS_COLORS, ROLE_LABELS, type Role, type WowClass } from '@/lib/design/class-colors';
import { isFirstAnswer } from '@/lib/signup-rules';
import type { RaidCard, RaidResponse } from '@/lib/raids';
import { viewerTime } from '@/lib/time';

/** A character the member can bring. The main comes first. */
export type QuestionCharacter = { id: string; name: string; wowClass: WowClass; spec: string; role: Role; isMain: boolean };

type Answer = 'accept' | 'tentative';
type Respond = (raidId: string, response: RaidResponse | null, remember?: boolean, choice?: CharacterChoice) => void;

/**
 * The server's rule, not a copy of it: the question opens when a member with several
 * characters and no default makes a first Accept or Tentative (the answer that would
 * otherwise bring the default or the main).
 */
export function asksCharacter(characters: readonly unknown[], defaultId: string | null, previous: RaidResponse | null, next: RaidResponse): boolean {
  return characters.length > 1 && defaultId === null && isFirstAnswer(previous, next);
}

/**
 * Wraps `respond` for the viewer's own answers. Returns `answer`, which either writes
 * straight away or opens the question, and the `question` window to render. Cancelling
 * writes nothing; confirming writes the answer with the character in one request.
 * Undo does not go through here, so it never opens the question.
 */
export function useCharacterQuestion(characters: QuestionCharacter[], defaultId: string | null, respond: Respond) {
  const [asked, setAsked] = useState<{ raid: RaidCard; response: Answer } | null>(null);
  const [chosenId, setChosenId] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  const answer = useCallback((raid: RaidCard, response: RaidResponse | null) => {
    if (response && response !== 'absent' && asksCharacter(characters, defaultId, raid.mine, response)) {
      setChosenId((characters.find((c) => c.isMain) ?? characters[0]).id);
      setMakeDefault(false);
      setAsked({ raid, response });
      return;
    }
    respond(raid.id, response);
  }, [characters, defaultId, respond]);

  const question: ReactNode = <CharacterQuestionWindow
    asked={asked}
    characters={characters}
    chosenId={chosenId}
    makeDefault={makeDefault}
    onChoose={setChosenId}
    onMakeDefault={setMakeDefault}
    onCancel={() => setAsked(null)}
    onConfirm={() => {
      const character = characters.find((c) => c.id === chosenId);
      if (asked && character) respond(asked.raid.id, asked.response, true, { characterId: character.id, role: character.role, makeDefault });
      setAsked(null);
    }}
  />;
  return { answer, question };
}

/** "Thu, Nov 26 · 8:00 PM PST": the day in the viewer's zone (guild time until it is known), then the start. */
function raidWhen(startsAt: string, zone: string | null, locale?: string): string {
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone ?? GUILD_TIMEZONE }).format(start);
  return `${day} · ${viewerTime(start, 0, zone, locale, { weekday: 'never' }).text}`;
}

type WindowProps = {
  asked: { raid: RaidCard; response: Answer } | null;
  characters: QuestionCharacter[];
  chosenId: string;
  makeDefault: boolean;
  onChoose: (id: string) => void;
  onMakeDefault: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function CharacterQuestionWindow({ asked, characters, chosenId, makeDefault, onChoose, onMakeDefault, onCancel, onConfirm }: WindowProps) {
  const viewer = useViewerTimeZone();
  const hintId = useId();
  // Keep the last raid while the dialog closes so its text does not vanish mid-fade.
  const [last, setLast] = useState(asked);
  if (asked && asked !== last) setLast(asked);
  const shown = asked ?? last;
  const when = shown ? raidWhen(shown.raid.startsAt, viewer?.zone ?? null, viewer ? navigator.language : undefined) : '';
  return (
    <Modal
      open={asked !== null}
      onClose={onCancel}
      title={CHARACTER_QUESTION.title}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>{CHARACTER_QUESTION.cancel}</Button>
          <Button onClick={onConfirm}>{shown?.response === 'tentative' ? CHARACTER_QUESTION.tentative : CHARACTER_QUESTION.accept}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {shown && <p className="text-fg-3">{shown.raid.name} · {when}</p>}
        <ChoiceGroup legend={CHARACTER_QUESTION.legend}>
          {characters.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-control border border-line-strong bg-ink-700 px-3.5 py-2.5 has-[:checked]:border-teal-dim has-[:checked]:bg-teal-wash">
              <input type="radio" name="character-question" value={c.id} checked={c.id === chosenId} onChange={() => onChoose(c.id)} className="h-4 w-4 shrink-0 accent-teal" />
              <ClassAvatar name={c.name} wowClass={c.wowClass} size={28} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold" style={{ color: CLASS_COLORS[c.wowClass].onInk }}>{c.name}</span>
                <span className="text-[13px] text-fg-3">{CLASS_COLORS[c.wowClass].label} · {c.spec} · {ROLE_LABELS[c.role]}</span>
              </span>
              {c.isMain && <span className="inline-flex items-center rounded-tag border border-line-strong bg-ink-700 px-2.5 py-[5px] text-xs font-semibold text-fg-2">{CHARACTER_QUESTION.main}</span>}
            </label>
          ))}
        </ChoiceGroup>
        <div className="flex flex-col">
          <label className="flex min-h-11 items-start gap-3 text-sm leading-normal text-fg-2">
            <input type="checkbox" aria-describedby={hintId} checked={makeDefault} onChange={(e) => onMakeDefault(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal" />
            <span>{CHARACTER_QUESTION.makeDefault}</span>
          </label>
          <span id={hintId} className="text-xs text-fg-3">{CHARACTER_QUESTION.hint}</span>
        </div>
      </div>
    </Modal>
  );
}
