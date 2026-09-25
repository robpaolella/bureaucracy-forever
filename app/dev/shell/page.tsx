import Link from 'next/link';
import { cookies } from 'next/headers';
import { Card } from '@/components/ui';
import { DEV_SESSION_COOKIE, DEV_SESSION_STATES, isDevSessionState } from '@/lib/session';

const DESCRIPTIONS: Record<(typeof DEV_SESSION_STATES)[number], string> = {
  out: 'Logged out. Both Discord buttons, no groups.',
  member: 'Member (Redtape, Priest). Members group, avatar pill.',
  'member-unsubmitted': 'Member who has not submitted availability. Warn note in the Members menu.',
  officer: 'Officer (Ledgerline, Warrior). Members and Officers groups, 7 pending applications.',
};

/** Build-order step 3: switch the stubbed session so the header can be reviewed. Gated by app/dev/layout.tsx. */
export default async function ShellDevPage() {
  const raw = (await cookies()).get(DEV_SESSION_COOKIE)?.value;
  const current = isDevSessionState(raw) ? raw : 'out';

  return (
    <main className="flex flex-col gap-8 px-4 pb-24 pt-20 md:px-gutter">
      <header className="flex flex-col gap-4 border-b border-line pb-7">
        <p className="font-eyebrow text-eyebrow font-semibold uppercase text-sand">Shell</p>
        <h1 className="font-display text-[3rem] font-medium leading-[1.05] tracking-[-0.02em]">Session switcher</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">
          Sets a dev-only cookie that stands in for Auth.js. Pick a state, then open{' '}
          <Link href="/" className="text-teal">
            the home page
          </Link>{' '}
          to see the header and footer in that state. Compare against reference/Nav-States.html.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DEV_SESSION_STATES.map((state) => (
          <Card key={state} accolade={state === current} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-title font-semibold">{state}</span>
              {state === current && <span className="text-label uppercase text-sand">current</span>}
            </div>
            <p className="text-small text-fg-2">{DESCRIPTIONS[state]}</p>
            <Link
              href={`/dev/session?as=${state}&back=/`}
              className="inline-flex h-11 items-center self-start rounded-control border border-line-strong bg-ink-700 px-4 text-[13px] font-semibold text-fg hover:brightness-110"
            >
              Use this state
            </Link>
          </Card>
        ))}
      </div>
    </main>
  );
}
