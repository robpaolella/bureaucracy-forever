import { NextResponse } from 'next/server';
import { decisionDm } from '@/content/dm-templates';
import { loadReminder } from '@/lib/application-reminders';
import { loadApplication } from '@/lib/applications-data';
import { orderedAnswers } from '@/lib/applications-inbox';
import { SITE_URL } from '@/lib/config';
import { latestInterview } from '@/lib/interviews';
import { authorizeBot, NO_STORE } from '../../_lib';

/** GET /api/bot/applications/:id — the application with its notes, for rendering (SYNC-SPEC §4). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { id } = await params;
  const app = await loadApplication(id);
  if (!app) return NextResponse.json({ error: 'No such application.' }, { status: 404, headers: NO_STORE });
  const [interview, reminder] = await Promise.all([latestInterview(app.id), loadReminder(app.id)]);
  return NextResponse.json(
    {
      ...app,
      interview,
      reminder: reminder ?? { pending: null, live: null },
      // The standard decline text, from the function the decision uses, so the preview is what a standard decline sends.
      declineMessage: decisionDm('declined', app.character),
      applicantDiscordId: app.discordId || null,
      answers: orderedAnswers(app.answers),
      url: `${SITE_URL}/officers/applications/${app.id}`,
    },
    { headers: NO_STORE },
  );
}
