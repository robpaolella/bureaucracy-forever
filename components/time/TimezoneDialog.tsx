'use client';

import { useMemo, useState } from 'react';
import { Button, Modal, Select } from '@/components/ui';
import { setViewerTimeZone, useViewerTimeZone } from './useViewerTimeZone';

function zoneOptions(): { value: string; label: string }[] {
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['UTC', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney'];
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}

/** The "Show times in a different timezone" dialog: the viewer's zone override, saved in this browser. */
export function TimezoneDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const viewer = useViewerTimeZone();
  // The zone being chosen; null until the viewer touches the select, then it shows their current zone.
  const [draft, setDraft] = useState<string | null>(null);
  const options = useMemo(() => zoneOptions(), []);
  const close = () => {
    setDraft(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Show times in a different timezone"
      actions={
        <>
          {viewer?.source === 'chosen' && (
            <Button
              variant="ghost"
              onClick={() => {
                setViewerTimeZone(null);
                close();
              }}
            >
              Use detected
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setViewerTimeZone(draft ?? viewer?.zone ?? 'UTC');
              close();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>Every time on the site will show in this zone, with guild time on hover or tap. Saved in this browser.</p>
        <Select label="Timezone" options={options} value={draft ?? viewer?.zone ?? 'UTC'} onChange={(e) => setDraft(e.target.value)} />
      </div>
    </Modal>
  );
}
