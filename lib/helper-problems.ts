/**
 * The raid's problems list (ADDON-SPEC 7.4, served by `GET /api/helper/raids/{raid}/problems`):
 * operations the site rejected, and operations it is holding for an award it doesn't have yet.
 * Reporting only.
 */
import 'server-only';

import { FORMAT_VERSION } from '@/lib/addon-operations';
import { db } from '@/lib/db';

export type ProblemRejection = { id: string; code: string; type?: string; key?: string; at: number };
export type ProblemPending = { id: string; type: 'award' | 'confirm' | 'not-confirmed' | 'void' | 'replace'; key: string; at: number };
export type Problems = { formatVersion: typeof FORMAT_VERSION; raid: string; generated: number; rejected: ProblemRejection[]; pending: ProblemPending[] };

export type ProblemsInput = {
  raidId: string;
  now: Date;
  /** Oldest first. */
  rejections: { opId: string; code: string; payload: unknown; receivedAt: Date }[];
  /** Oldest first. */
  pending: { opId: string; type: 'AWARD' | 'CONFIRM' | 'NOT_CONFIRMED' | 'VOID' | 'REPLACE'; key: string; receivedAt: Date }[];
};

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
const TYPES = { AWARD: 'award', CONFIRM: 'confirm', NOT_CONFIRMED: 'not-confirmed', VOID: 'void', REPLACE: 'replace' } as const;

/** A rejected payload is whatever the add-on sent, so only plain strings are echoed back. */
function text(payload: unknown, field: 'type' | 'key'): string | undefined {
  const value = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[field] : undefined;
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined;
}

export function buildProblems(input: ProblemsInput): Problems {
  return {
    formatVersion: FORMAT_VERSION,
    raid: input.raidId,
    generated: seconds(input.now),
    rejected: input.rejections.map((r): ProblemRejection => {
      const type = text(r.payload, 'type');
      const key = text(r.payload, 'key');
      return { id: r.opId, code: r.code, ...(type ? { type } : {}), ...(key ? { key } : {}), at: seconds(r.receivedAt) };
    }),
    pending: input.pending.map((p): ProblemPending => ({ id: p.opId, type: TYPES[p.type], key: p.key, at: seconds(p.receivedAt) })),
  };
}

/** A raid's problems from the database, or null when this site doesn't hold the raid. A cancelled raid still has its list. */
export async function loadProblems(raidId: string, now: Date = new Date()): Promise<Problems | null> {
  const [raid, rejections, pending] = await Promise.all([
    db.raid.findUnique({ where: { id: raidId }, select: { id: true } }),
    db.lootOperationRejection.findMany({
      where: { raidId },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: { opId: true, code: true, payload: true, receivedAt: true },
    }),
    db.lootOperation.findMany({
      where: { raidId, status: 'PENDING' },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: { opId: true, type: true, key: true, receivedAt: true },
    }),
  ]);
  if (!raid) return null;
  return buildProblems({ raidId, now, rejections, pending });
}
