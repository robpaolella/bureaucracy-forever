import { NextResponse } from 'next/server';
import { CLASS_COLORS, CLASSES, ROLE_LABELS, SPECS } from '@/lib/design/class-colors';
import { authorizeBot, NO_STORE } from '../_lib';

/**
 * GET /api/bot/classes — every class with its specs and the raid roles each spec can fill
 * (SYNC-SPEC §4). The bot's "Set my main" menus are built from this, so the site's class data
 * stays the one copy.
 */
export function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  return NextResponse.json(
    {
      roles: ROLE_LABELS,
      classes: CLASSES.map((key) => ({ key, label: CLASS_COLORS[key].label, specs: SPECS[key].map((s) => ({ name: s.name, roles: s.roles })) })),
    },
    { headers: { ...NO_STORE, 'Cache-Control': 'private, max-age=3600' } },
  );
}
