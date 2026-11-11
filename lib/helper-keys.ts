/**
 * Officers' keys for the loot helper (ADDON-SPEC section 7.2). A key is `bfh_` plus 32 random
 * bytes in base64url, shown once at creation; only its SHA-256 hash is stored. `verify` checks
 * the owner's stored role on every call (the Discord bot keeps it in step), so a key stops
 * working once the bot syncs a demotion, whatever the owner was when it was made (Robert,
 * 2026-10-14). Revoking keeps the row.
 */
import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import type { Session } from '@/lib/session';

export const HELPER_KEY_PREFIX = 'bfh_';
export const HELPER_KEY_NAME_MAX = 40;
const KEY_PATTERN = /^bfh_[A-Za-z0-9_-]{43}$/;

export type Refusal = { ok: false; status: 400 | 401 | 403 | 404; error: string };
export type HelperKeySummary = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null };
export type VerifyResult = { ok: true; userId: string; keyId: string } | { ok: false; status: 401 | 403 };

export function newHelperKey(): string {
  return HELPER_KEY_PREFIX + randomBytes(32).toString('base64url');
}

export function hashHelperKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** The trimmed name, or the reason it can't be used, worded for the officer. */
export function helperKeyName(input: unknown): { ok: true; name: string } | Refusal {
  const name = typeof input === 'string' ? input.trim() : '';
  if (!name) return { ok: false, status: 400, error: 'Give the key a name.' };
  if ([...name].length > HELPER_KEY_NAME_MAX) return { ok: false, status: 400, error: `Keep the name to ${HELPER_KEY_NAME_MAX} characters or fewer.` };
  return { ok: true, name };
}

function officerOnly(session: Session | null): Refusal | null {
  if (!session) return { ok: false, status: 401, error: 'Log in first.' };
  if (session.role !== 'officer') return { ok: false, status: 403, error: 'Officers only.' };
  return null;
}

const SUMMARY = { id: true, name: true, createdAt: true, lastUsedAt: true } as const;

/** Make a key for the signed-in officer. The plain `key` is in this result and nowhere else. */
export async function createHelperKey(session: Session | null, name: unknown): Promise<({ ok: true; key: string } & HelperKeySummary) | Refusal> {
  const refused = officerOnly(session);
  if (refused) return refused;
  const parsed = helperKeyName(name);
  if (!parsed.ok) return parsed;
  // Not ensureUser: it copies the session's role onto the row, and an hour-old officer
  // session would then undo a demotion the bot synced, reviving the user's keys.
  const user = await db.user.upsert({
    where: { discordId: session!.discordId },
    create: { discordId: session!.discordId, discordName: session!.name, role: 'OFFICER' },
    update: {},
    select: { id: true },
  });
  const key = newHelperKey();
  const row = await db.helperKey.create({ data: { userId: user.id, name: parsed.name, keyHash: hashHelperKey(key) }, select: SUMMARY });
  return { ok: true, key, ...row };
}

/** The signed-in officer's own live keys, newest first. */
export async function listHelperKeys(session: Session | null): Promise<{ ok: true; keys: HelperKeySummary[] } | Refusal> {
  const refused = officerOnly(session);
  if (refused) return refused;
  const keys = await db.helperKey.findMany({
    where: { user: { discordId: session!.discordId }, revokedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: SUMMARY,
  });
  return { ok: true, keys };
}

/** Revoke one of the signed-in officer's own live keys. Anyone else's, or an unknown one, is not found. */
export async function revokeHelperKey(session: Session | null, keyId: string): Promise<{ ok: true } | Refusal> {
  const refused = officerOnly(session);
  if (refused) return refused;
  const { count } = await db.helperKey.updateMany({
    where: { id: keyId, user: { discordId: session!.discordId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count ? { ok: true } : { ok: false, status: 404, error: 'That key wasn’t found. It may already be revoked.' };
}

/** 401 for a malformed, unknown or revoked key; 403 when its owner is not an officer now. */
export async function verifyHelperKey(key: string | null | undefined): Promise<VerifyResult> {
  if (!key || !KEY_PATTERN.test(key)) return { ok: false, status: 401 };
  const row = await db.helperKey.findUnique({
    where: { keyHash: hashHelperKey(key) },
    select: { id: true, revokedAt: true, user: { select: { id: true, role: true } } },
  });
  if (!row || row.revokedAt) return { ok: false, status: 401 };
  if (row.user.role !== 'OFFICER') return { ok: false, status: 403 };
  return { ok: true, userId: row.user.id, keyId: row.id };
}

/** Stamp a verified key's last use. A key revoked in the meantime is left alone. */
export async function recordHelperKeyUse(keyId: string, at: Date = new Date()): Promise<void> {
  await db.helperKey.updateMany({ where: { id: keyId, revokedAt: null }, data: { lastUsedAt: at } });
}
