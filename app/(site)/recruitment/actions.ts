'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApplicationState } from '@/components/recruitment/form-state';
import { FORM } from '@/content/recruitment';
import { isHoneypotFilled, parseApplication, submittedSearch } from '@/lib/applications';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { clientAddress, rateLimited } from '@/lib/rate-limit';
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

  if (rateLimited(`application:${clientAddress(await headers())}`, LIMIT, WINDOW_MS)) return { ok: false, errors: {}, message: FORM.tooMany };

  // One pending application per character: check and insert in one serializable
  // transaction so a double submit cannot slip two rows through.
  let duplicate = false;
  try {
    duplicate = await db.$transaction(
      async (tx) => {
        const pending = await tx.application.findFirst({ where: { status: 'PENDING', character: { equals: value.character, mode: 'insensitive' } }, select: { id: true } });
        if (pending) return true;
        await tx.application.create({
          data: {
            path: value.path === 'social' ? 'SOCIAL' : 'RAIDER',
            // '' means no Discord account is known: the inbox and the bot must fall back to discordName.
            discordId: session?.discordId ?? '',
            discordName: value.discord,
            character: value.character,
            class: value.wowClass ? (value.wowClass.toUpperCase() as Uppercase<typeof value.wowClass>) : null,
            spec: value.spec,
            logsUrl: value.logsUrl,
            answers: value.answers,
          },
        });
        return false;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') duplicate = true;
    else throw e;
  }
  if (duplicate) return { ok: false, errors: { character: FORM.duplicate } };
  redirect(`/recruitment/submitted?${submittedSearch(value)}`);
}
