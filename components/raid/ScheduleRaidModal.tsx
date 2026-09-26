'use client';

import { Modal } from '@/components/ui';
import type { RaidInput } from '@/lib/raids';
import { SAVE_FAILED, SCHEDULE_FORM } from '@/content/calendar';
import { RaidForm } from './RaidForm';

type Created = { id: string; name: string; startsAt: string };

type Props = {
  open: boolean;
  initial: RaidInput;
  onClose: () => void;
  onScheduled: (raid: Created) => void;
};

/** The schedule form in a modal, posting to /api/raids. Officers only reach it. */
export function ScheduleRaidModal({ open, initial, onClose, onScheduled }: Props) {
  async function submit(input: RaidInput): Promise<string | null> {
    try {
      const res = await fetch('/api/raids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        credentials: 'same-origin',
      });
      if (res.status === 400) return ((await res.json()) as { error?: string }).error ?? SAVE_FAILED;
      if (!res.ok) return SAVE_FAILED;
      onScheduled((await res.json()) as Created);
      return null;
    } catch {
      return SAVE_FAILED;
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={SCHEDULE_FORM.title}>
      {open && <RaidForm key={initial.date + initial.time} initial={initial} submitLabel={SCHEDULE_FORM.submit} onSubmit={submit} onCancel={onClose} />}
    </Modal>
  );
}
