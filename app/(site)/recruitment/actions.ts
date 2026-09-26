'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApplicationState } from '@/components/recruitment/form-state';
import { FORM } from '@/content/recruitment';
import { isHoneypotFilled, parseApplication, submittedSearch } from '@/lib/applications';
import { db } from '@/lib/db';
import { rateLimited } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

const LIMIT = 5;
const WINDOW_MS = 60 * 60_000;

/**
 * The public application form (docs/04 § Recruitment). Anyone may apply, no login: the
 * Discord handle comes from the session when there is one and from the form otherwise.
 * Spam controls: a honeypot field, a per-address limit, and one pending application per
 * character. On success the applicant lands on /recruitment/submitted.
 */
export async function submitApplication(_prev: ApplicationState, data: FormData): Promise<ApplicationState> {
  const session = await getSession();
  const parsed = parseApplication(data, session?.name ?? null);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { value } = parsed;

  // A bot filled the field nobody sees: pretend it worked and store nothing.
  if (isHoneypotFilled(data)) redirect(`/recruitment/submitted?${submittedSearch(value)}`);

  const address = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(`application:${address}`, LIMIT, WINDOW_MS)) return { ok: false, errors: {}, message: FORM.tooMany };

  const pending = await db.application.findFirst({ where: { status: 'PENDING', character: { equals: value.character, mode: 'insensitive' } }, select: { id: true } });
  if (pending) return { ok: false, errors: { character: FORM.duplicate } };

  await db.application.create({
    data: {
      path: value.path === 'social' ? 'SOCIAL' : 'RAIDER',
      discordId: session?.discordId ?? '',
      discordName: value.discord,
      character: value.character,
      class: value.wowClass ? (value.wowClass.toUpperCase() as Uppercase<typeof value.wowClass>) : null,
      spec: value.spec,
      logsUrl: value.logsUrl,
      answers: value.answers,
    },
  });
  redirect(`/recruitment/submitted?${submittedSearch(value)}`);
}
