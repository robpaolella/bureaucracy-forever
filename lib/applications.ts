/**
 * The public application form (docs/04 § Recruitment, § Application submitted). Pure
 * validation shared by the server action and its tests; persistence lives in the action.
 */
import type { ApplicationPath } from '@/components/recruitment/form-state';
import { FORM } from '@/content/recruitment';
import { CLASSES, SPECS, type WowClass } from '@/lib/design/class-colors';

export type ApplicationInput = {
  path: ApplicationPath;
  character: string;
  /** The Discord handle as typed, lower-cased; from the session when logged in. */
  discord: string;
  wowClass: WowClass | null;
  spec: string | null;
  logsUrl: string | null;
  /** { availability, wipe } for raiders, { note } for socials. */
  answers: Record<string, string>;
};

export type ParsedApplication = { ok: true; value: ApplicationInput } | { ok: false; errors: Record<string, string> };

// Letters only, any script; the Latin-1 range would let × and ÷ through.
const CHARACTER = /^\p{L}{2,12}$/u;
// Discord usernames: 2–32 of letters, digits, underscore, full stop; legacy tags may carry #1234.
const DISCORD = /^[\p{L}\p{N}_.]{2,32}(#\d{4})?$/u;
export const ANSWER_MAX = 2000;

/** The honeypot field: bots fill it, people never see it. */
export const HONEYPOT_FIELD = 'website';

export function normaliseCharacter(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function text(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/** Validate the form. `sessionHandle` wins over the typed handle when the applicant is logged in. */
export function parseApplication(data: FormData, sessionHandle: string | null): ParsedApplication {
  const errors: Record<string, string> = {};
  const path: ApplicationPath = text(data, 'path') === 'social' ? 'social' : 'raider';

  const rawCharacter = text(data, 'character');
  if (!CHARACTER.test(rawCharacter)) errors.character = 'Character names are 2–12 letters, exactly as in game.';

  const discord = (sessionHandle ?? text(data, 'discord')).toLowerCase().replace(/^@/, '');
  if (!DISCORD.test(discord)) errors.discord = 'Your Discord handle, so an officer can reach you.';

  let wowClass: WowClass | null = null;
  let spec: string | null = null;
  let logsUrl: string | null = null;
  const answers: Record<string, string> = {};

  if (path === 'raider') {
    const cls = text(data, 'class');
    if (!(CLASSES as readonly string[]).includes(cls)) errors.class = 'Choose a class.';
    else wowClass = cls as WowClass;
    const sp = text(data, 'spec');
    if (wowClass && !SPECS[wowClass].some((s) => s.name === sp)) errors.spec = 'Choose a spec.';
    else if (wowClass) spec = sp;

    const logs = text(data, 'logs');
    try {
      const url = new URL(logs);
      if (!/^https?:$/.test(url.protocol)) throw new Error();
      logsUrl = url.toString().slice(0, 500);
    } catch {
      errors.logs = 'We need a link to at least one parse before we can review this.';
    }

    const availability = text(data, 'availability');
    if (!(FORM.availabilityOptions as readonly string[]).includes(availability)) errors.availability = 'Pick one.';
    else answers.availability = availability;

    const wipe = text(data, 'wipe');
    if (wipe.length < 20) errors.wipe = 'A few honest sentences.';
    else answers.wipe = wipe.slice(0, ANSWER_MAX);

    if (data.get('agree') !== 'on') errors.agree = 'Read the loot rules and the expectations first.';
  } else {
    const note = text(data, 'note');
    if (note) answers.note = note.slice(0, ANSWER_MAX);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { path, character: normaliseCharacter(rawCharacter), discord, wowClass, spec, logsUrl, answers } };
}

/** Whether the hidden field was filled: a bot, answered with a quiet redirect and no row. */
export function isHoneypotFilled(data: FormData): boolean {
  return text(data, HONEYPOT_FIELD).length > 0;
}

/** The query string the submitted page reads to repeat what went through. */
export function submittedSearch(value: Pick<ApplicationInput, 'path' | 'character' | 'wowClass' | 'spec'>): string {
  const params = new URLSearchParams({ path: value.path, character: value.character });
  if (value.wowClass) params.set('class', value.wowClass);
  if (value.spec) params.set('spec', value.spec);
  return params.toString();
}
