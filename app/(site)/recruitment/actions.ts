'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApplicationState } from '@/components/recruitment/form-state';
import { FORM } from '@/content/recruitment';
import { isHoneypotFilled, parseApplication, submittedSearch } from '@/lib/applications';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { Prisma } from '@/lib/generated/prisma/client';
import { clientAddress, rateLimited } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

const LIMIT = 5;
const WINDOW_MS = 60 * 60_000;

/**
 * The application form on /apply (SYNC-SPEC §9.1): a Discord sign-in is required, so the
 * handle always comes from the session and every application is tied to an account.
 * Spam controls: a honeypot field, a per-address limit, one pending application per
 * character and one per account. On success the applicant lands on /recruitment/submitted.
 */
export async function submitApplication(_prev: ApplicationState, data: FormData): Promise<ApplicationState> {
  const session = await getSession();
  if (!session) return { ok: false, errors: {}, message: FORM.signInRequired };
  const parsed = parseApplication(data, session.name);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { value } = parsed;

  // A bot filled the field nobody sees: pretend it worked and store nothing.
  if (isHoneypotFilled(data)) redirect(`/recruitment/submitted?${submittedSearch(value)}`);

  if (rateLimited(`application:${clientAddress(await headers())}`, LIMIT, WINDOW_MS)) return { ok: false, errors: {}, message: FORM.tooMany };

  // One pending application per character: check and insert in one serializable
  // transaction so a double submit cannot slip two rows through.
  let duplicate: boolean | 'account' = false;
  try {
    duplicate = await db.$transaction(
      async (tx) => {
        const pending = await tx.application.findFirst({ where: { status: 'PENDING', character: { equals: value.character, mode: 'insensitive' } }, select: { id: true } });
        if (pending) return true;
        // SYNC-SPEC §9.1: one pending application per Discord account.
        {
          const mine = await tx.application.findFirst({ where: { status: 'PENDING', discordId: session.discordId }, select: { id: true } });
          if (mine) return 'account' as const;
        }
        const created = await tx.application.create({
          select: { id: true },
          data: {
            path: value.path === 'social' ? 'SOCIAL' : 'RAIDER',
            discordId: session.discordId,
            discordName: value.discord,
            character: value.character,
            class: value.wowClass ? (value.wowClass.toUpperCase() as Uppercase<typeof value.wowClass>) : null,
            spec: value.spec,
            logsUrl: value.logsUrl,
            answers: value.answers,
          },
        });
        // The bot posts it to #applications on its next poll (SYNC-SPEC §5).
        await enqueue('application.post', { applicationId: created.id, character: value.character }, tx);
        return false;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') duplicate = true;
    else throw e;
  }
  if (duplicate === 'account') return { ok: false, errors: {}, message: FORM.duplicateAccount };
  if (duplicate) return { ok: false, errors: { character: FORM.duplicate } };
  redirect(`/recruitment/submitted?${submittedSearch(value)}`);
}
