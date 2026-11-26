import { NextResponse } from 'next/server';
import { FORMAT_VERSION } from '@/lib/addon-operations';
import { addonForSnapshot, getAddonRelease } from '@/lib/addon-release';
import { db } from '@/lib/db';
import { guardHelperRequest, HELPER_NO_STORE, helperError, siteEnv } from '@/lib/helper-api';

/**
 * GET /api/helper/me — checks the helper's key (ADDON-SPEC 7.1). 200
 * `{ officer, env, formatVersions, addon: { version, url } }`, where `officer` is the key
 * owner's Discord name, for "Connected as …". `addon` is the snapshot's own (#280's cached lookup).
 */
export async function GET(request: Request) {
  const caller = await guardHelperRequest(request);
  if ('deny' in caller) return caller.deny;
  const user = await db.user.findUnique({ where: { id: caller.userId }, select: { discordName: true } });
  if (!user) return helperError(401, 'bad-key', 'That helper key isn’t recognised. It may have been revoked, or be from the other site.');
  return NextResponse.json(
    { officer: user.discordName, env: siteEnv(), formatVersions: [FORMAT_VERSION], addon: addonForSnapshot(await getAddonRelease()) },
    { headers: HELPER_NO_STORE },
  );
}
