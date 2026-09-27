import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseRequirements } from '@/lib/raids';
import { NO_STORE, requireOfficer } from '../_officer';

/** GET /api/raid-templates — every template, active first (officers). */
export async function GET() {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const rows = await db.raidTemplate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  return NextResponse.json({ templates: rows.map((t) => ({ ...t, requirements: parseRequirements(t.requirements) })) }, { headers: NO_STORE });
}
