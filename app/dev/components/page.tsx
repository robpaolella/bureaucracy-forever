import type { ReactNode } from 'react';
import {
  Button,
  Card,
  Choice,
  ChoiceGroup,
  CountBadge,
  EmptyState,
  Field,
  Input,
  ModalPanel,
  RankBadge,
  Select,
  SkeletonText,
  SourceBadge,
  StatCard,
  StatusPill,
  Tag,
  Textarea,
  TextLink,
} from '@/components/ui';
import { LoadingButtonDemo, ModalDemo, TableDemo, ToggleDemo, RosterPrimitivesDemo } from './demos';

/**
 * Build-order step 2. Mirrors design-handover/reference/Components.html so the
 * primitives can be checked side by side. Dev-only; not linked from anywhere.
 */

const LABEL = 'text-label font-semibold uppercase text-fg-3';

function SectionHead({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3.5">
      <h2 className="font-display text-[26px] font-medium">{title}</h2>
      <span className="text-xs tracking-[0.04em] text-fg-3">{code}</span>
    </div>
  );
}

function Panel({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <Card padding="lg" className={`flex flex-col gap-5 ${className ?? ''}`}>
      {label && <div className={LABEL}>{label}</div>}
      {children}
    </Card>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-fg-2" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M4.5 8h7M7 12h2" />
    </svg>
  );
}

export default function ComponentsPage() {
  return (
    <main className="flex flex-col gap-16 px-4 pb-24 pt-20 md:px-gutter">
      <header className="flex flex-col gap-4 border-b border-line pb-7">
        <p className="font-eyebrow text-eyebrow font-semibold uppercase text-sand">Components</p>
        <h1 className="font-display text-[3rem] font-medium leading-[1.05] tracking-[-0.02em]">Primitives</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">
          Names in grey are the React components to build. Every page in this canvas is assembled from
          these and nothing else.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <SectionHead title="Button" code="<Button variant size loading disabled>" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel label="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Apply to raid</Button>
              <Button variant="secondary">Join Discord</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Decline</Button>
              <TextLink href="#buttons">Read the loot rules</TextLink>
            </div>
            <div className="flex gap-5 text-xs text-fg-3">
              <span>primary</span>
              <span>secondary</span>
              <span>ghost</span>
              <span>danger</span>
              <span>link</span>
            </div>
          </Panel>
          <Panel label="Sizes & states">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg">Large</Button>
              <Button size="md">Medium</Button>
              <Button size="sm" variant="secondary">
                Small
              </Button>
              <Button disabled>Disabled</Button>
              <LoadingButtonDemo />
              <Button variant="secondary" iconOnly aria-label="Filter roster">
                <FilterIcon />
              </Button>
            </div>
            <div className="text-xs leading-relaxed text-fg-3">
              Minimum hit target 44px everywhere, including the small variant — it is short, not thin.
            </div>
          </Panel>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead title="Fields" code="<Field label hint error> · <Select> · <Choice> · <Toggle>" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="gap-[22px]">
            <Field label="Character name" hint="Exactly as it appears in game.">
              <Input defaultValue="Ledgerline" />
            </Field>
            <Field label="Logs link" error="We need at least one parse before we can review this.">
              <Input placeholder="https://" />
            </Field>
          </Panel>
          <Panel className="gap-[22px]">
            <Select
              label="Class"
              defaultValue="warrior"
              options={[
                { value: 'warrior', label: 'Warrior' },
                { value: 'priest', label: 'Priest' },
                { value: 'mage', label: 'Mage' },
              ]}
            />
            <Field label="Why Bureaucracy?">
              <Textarea rows={4} placeholder="A few honest sentences." />
            </Field>
          </Panel>
          <Panel className="gap-[22px]">
            <ChoiceGroup legend="Application path">
              <Choice card type="radio" name="path" label="Raider" defaultChecked />
              <Choice card type="radio" name="path" label="Social" />
            </ChoiceGroup>
            <Choice type="checkbox" label="I have read the loot rules and the raider expectations." defaultChecked />
            <ToggleDemo />
          </Panel>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead title="Tags, pills & badges" code="<Tag> · <StatusPill> · <RankBadge> · <SourceBadge>" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col gap-4">
            <div className={LABEL}>Role</div>
            <div className="flex flex-wrap gap-2">
              <Tag>Tank</Tag>
              <Tag>Healer</Tag>
              <Tag>Melee DPS</Tag>
              <Tag>Ranged DPS</Tag>
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className={LABEL}>Status</div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="ok">High need</StatusPill>
              <StatusPill tone="warn">Medium</StatusPill>
              <StatusPill tone="closed">Closed</StatusPill>
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className={LABEL}>Rank</div>
            <div className="flex flex-wrap gap-2">
              <RankBadge rank="officer" />
              <RankBadge rank="raider" />
              <RankBadge rank="trial" />
              <RankBadge rank="social" />
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className={LABEL}>Sign-up source</div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source="web" />
              <SourceBadge source="discord" />
              <CountBadge>7</CountBadge>
            </div>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead title="Roster & calendar controls" code="<SegmentedControl> · <FilterBar> · <MultiSelect> · <Sheet> · <ClassAvatar> · <ProgressTrack>" />
        <Panel>
          <RosterPrimitivesDemo />
        </Panel>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead title="Data table" code="<DataTable columns rows sort density> — 44px rows, 40+ people without a scroll trap" />
        <TableDemo />
      </section>

      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <SectionHead title="Cards" code="<Card> · <StatCard>" />
          <div className="flex flex-col gap-3.5">
            <StatCard eyebrow="Naxxramas" figure="Top 500" caption="worldwide, cleared at release" />
            <Card hover className="flex flex-col gap-2.5">
              <span className="text-body-l font-semibold">Wednesday — Blackwing Lair</span>
              <span className="text-sm leading-relaxed text-fg-2">
                8:00 PM guild · 10:00 PM your time. Invites at ten to, first pull on the hour.
              </span>
              <TextLink href="#cards" className="self-start text-[13px]">
                Sign up →
              </TextLink>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SectionHead title="Modal" code="<Modal>" />
          <div className="flex flex-col gap-3.5">
            <div className="rounded-card border border-line bg-ink-950 p-7">
              <ModalPanel
                title="Decline Subclause?"
                actions={
                  <>
                    <Button variant="ghost">Keep pending</Button>
                    <Button variant="danger">Decline</Button>
                  </>
                }
              >
                They will get a note in Discord. Your officer comments stay private.
              </ModalPanel>
            </div>
            <ModalDemo />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SectionHead title="Empty & loading" code="<EmptyState> · <Skeleton>" />
          <div className="flex flex-col gap-3.5">
            <EmptyState
              title="Nothing on the calendar yet"
              action={
                <Button variant="secondary" size="sm" className="bg-transparent">
                  Schedule a raid
                </Button>
              }
            >
              Officers schedule raids from Discord or here. The next one will show up the moment it is
              posted.
            </EmptyState>
            <Card className="p-5">
              <SkeletonText />
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
