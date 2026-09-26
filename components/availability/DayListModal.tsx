'use client';

import { Button, Modal } from '@/components/ui';
import { fmtSlot, SLOTS, slotKey, type SlotState, type Week, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';

type Props = {
  day: WeekDay | null;
  week: Week;
  /** Half-hour slots the server clock is ahead of the member's. */
  offsetSlots: number;
  onSet: (day: number, slot: number, state: SlotState | null) => void;
  onClose: () => void;
};

const OPTIONS: Array<{ value: SlotState | 'off'; label: string }> = [
  { value: 'available', label: 'Available' },
  { value: 'if-needed', label: 'If needed' },
  { value: 'off', label: 'Off' },
];

/**
 * The keyboard alternative to painting (docs/05): one day's 48 half-hours as 44px rows
 * with Available / If needed / Off radios. Nobody should have to drag to use this page.
 */
export function DayListModal({ day, week, offsetSlots, onSet, onClose }: Props) {
  return (
    <Modal
      open={day !== null}
      onClose={onClose}
      title={day ? `${day.longName} ${day.date}` : ''}
      actions={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      {day && (
        <div className="flex flex-col">
          <p className="pb-3">Set each half-hour. Times are yours; the server time follows in grey.</p>
          <div className="-mx-2 max-h-[60vh] overflow-y-auto">
            {Array.from({ length: SLOTS }, (_, slot) => {
              const key = slotKey(day.day, slot);
              const current = week[key] ?? 'off';
              return (
                <fieldset
                  key={slot}
                  className={cn('flex min-h-11 items-center gap-3 px-2', slot % 2 === 0 ? 'border-t border-line-faint' : 'border-t border-line-hairline')}
                >
                  <legend className="sr-only">
                    {day.name} {fmtSlot(slot)}
                  </legend>
                  <span className="tabular w-[92px] shrink-0 text-xs text-fg-muted">
                    {fmtSlot(slot)}
                    <span className="block text-[10px] text-fg-3">{fmtSlot(slot + offsetSlots)} server</span>
                  </span>
                  <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1">
                    {OPTIONS.map((o) => (
                      <label key={o.value} className="flex min-h-11 items-center gap-1.5 text-xs text-fg-2">
                        <input
                          type="radio"
                          name={`slot-${day.day}-${slot}`}
                          value={o.value}
                          checked={current === o.value}
                          onChange={() => onSet(day.day, slot, o.value === 'off' ? null : o.value)}
                          className="h-4 w-4 accent-teal"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
