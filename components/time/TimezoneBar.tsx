'use client';

import { useMemo, useState } from 'react';
import { Button, Modal, Select } from '@/components/ui';
import { REALM_TIMEZONE } from '@/lib/config';
import { formatUtcOffset, zoneAbbreviation } from '@/lib/time';
import { setViewerTimeZone, useViewerTimeZone } from './useViewerTimeZone';

const LABEL = 'text-label font-semibold uppercase';

function zoneOptions(): { value: string; label: string }[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['UTC', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney'];
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}

/**
 * The canonical dual-time block (docs/04 § Raid schedule): server zone in sand, the
 * viewer's zone in teal with a Detected / Chosen pill, and a button to override.
 * Reused at the top of the availability pages.
 */
export function TimezoneBar() {
  const viewer = useViewerTimeZone();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  // The instant the abbreviations and offsets are read at. Frozen for the component's
  // life: a page left open across a DST change shows the old offset until reload, which
  // is a deliberate trade against re-rendering every tick.
  const now = useMemo(() => new Date(), []);
  const options = useMemo(() => zoneOptions(), []);

  const realm = `Realm · ${zoneAbbreviation(now, REALM_TIMEZONE)} (${formatUtcOffset(now, REALM_TIMEZONE)})`;
  const yours = viewer ? `${viewer.zone} · ${zoneAbbreviation(now, viewer.zone)} (${formatUtcOffset(now, viewer.zone)})` : 'Detecting…';

  const openPicker = () => {
    setDraft(viewer?.zone ?? 'UTC');
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-ink-850 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-[26px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-12 sm:gap-y-4">
        <div className="flex flex-col gap-[5px]">
          <span className={`${LABEL} text-sand`}>Server time</span>
          <span className="tabular text-base font-semibold">{realm}</span>
        </div>
        <div className="hidden h-[38px] w-px bg-line sm:block" aria-hidden />
        <div className="flex flex-col gap-[5px]">
          <span className={`${LABEL} text-teal`}>Your time</span>
          <span className="tabular text-base font-semibold">{yours}</span>
        </div>
        {viewer && (
          <span className="self-start rounded-tag border border-teal-dim bg-teal-wash px-2.5 py-[5px] text-label font-semibold uppercase tracking-[0.08em] text-teal sm:self-center">
            {viewer.source === 'chosen' ? 'Chosen' : 'Detected'}
          </span>
        )}
      </div>
      <Button variant="secondary" size="sm" className="self-start bg-transparent px-[18px] lg:self-center" onClick={openPicker}>
        Use a different timezone
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Show times in a different timezone"
        actions={
          <>
            {viewer?.source === 'chosen' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setViewerTimeZone(null);
                  setOpen(false);
                }}
              >
                Use detected
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setViewerTimeZone(draft);
                setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p>Every time on the site will show in this zone beside server time. Saved in this browser.</p>
          <Select label="Timezone" options={options} value={draft ?? ''} onChange={(e) => setDraft(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
