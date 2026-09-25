'use server';

import type { ApplicationPath, ApplicationState } from '@/components/recruitment/form-state';
import { FORM } from '@/content/recruitment';
import { CLASSES, SPECS, type WowClass } from '@/lib/design/class-colors';

const CHARACTER = /^[A-Za-zÀ-ÿ]{2,12}$/;

function text(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Validates the public application form. Persistence and the officer inbox arrive with
 * build-order step 9 (POST /api/applications, rate-limited); until then a valid form
 * gets the not-open notice rather than a false "received".
 */
export async function submitApplication(_prev: ApplicationState, data: FormData): Promise<ApplicationState> {
  const errors: Record<string, string> = {};
  const path: ApplicationPath = text(data, 'path') === 'social' ? 'social' : 'raider';

  const character = text(data, 'character');
  if (!CHARACTER.test(character)) errors.character = 'Character names are 2–12 letters, exactly as in game.';

  if (path === 'raider') {
    const wowClass = text(data, 'class') as WowClass;
    if (!(CLASSES as readonly string[]).includes(wowClass)) errors.class = 'Choose a class.';
    const spec = text(data, 'spec');
    if (!errors.class && !SPECS[wowClass].some((s) => s.name === spec)) errors.spec = 'Choose a spec.';

    const logs = text(data, 'logs');
    try {
      const url = new URL(logs);
      if (!/^https?:$/.test(url.protocol)) throw new Error();
    } catch {
      errors.logs = 'We need a link to at least one parse before we can review this.';
    }

    if (!(FORM.availabilityOptions as readonly string[]).includes(text(data, 'availability'))) errors.availability = 'Pick one.';
    if (text(data, 'wipe').length < 20) errors.wipe = 'A few honest sentences.';
    if (data.get('agree') !== 'on') errors.agree = 'Read the loot rules and the expectations first.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: false, errors: {}, message: FORM.notOpen };
}
