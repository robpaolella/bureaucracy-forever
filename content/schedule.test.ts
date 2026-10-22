import { describe, expect, it } from 'vitest';
import { RAID_NIGHTS, RAID_WEEK, RUN_OF_NIGHT, SCHEDULE_ASIDES, SCHEDULE_HEAD, slotTime } from './schedule';

describe('schedule copy', () => {
  it('uses the approved Raiding intro word for word', () => {
    expect(SCHEDULE_HEAD.lede).toBe(
      "Raid times show in your own time zone, so you'll always know when raid starts where you are. Our optional night is still to be set.",
    );
  });

  it('has Attendance, Sign-ups and Loot rows with the approved wording, and no link', () => {
    expect(SCHEDULE_ASIDES).toEqual([
      { title: 'Attendance', text: "Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." },
      { title: 'Sign-ups', text: 'Sign up for each raid as Accept, Tentative or Absent, on the calendar or with our bot in Discord.' },
      { title: 'Loot', text: 'Loot runs on hard reserve, then soft reserve, then open roll.' },
    ]);
  });

  it('sets Tuesday and Thursday at 20:00 for 180 minutes, and the optional night without a time', () => {
    expect(RAID_WEEK.map((s) => s.day)).toEqual(['Tuesday', 'Thursday', 'Optional Day']);
    const from = new Date('2026-10-22T12:00:00Z');
    expect(slotTime(RAID_WEEK[0], from)).toEqual({ startsAt: '2026-10-28T03:00:00.000Z', durationMin: 180 });
    expect(slotTime(RAID_WEEK[1], from)).toEqual({ startsAt: '2026-10-23T03:00:00.000Z', durationMin: 180 });
    expect(slotTime(RAID_WEEK[2], from)).toBeNull();
  });

  it('follows daylight saving: 8:00 PM Pacific is 04:00Z in winter', () => {
    expect(slotTime(RAID_WEEK[0], new Date('2026-11-10T12:00:00Z'))?.startsAt).toBe('2026-11-11T04:00:00.000Z');
  });

  it('keeps the unused placeholder data consistent with the real nights', () => {
    expect(RAID_NIGHTS.filter((n) => !n.optional).map((n) => [n.day, n.start, n.end])).toEqual([
      [2, '20:00', '23:00'],
      [4, '20:00', '23:00'],
    ]);
    expect(JSON.stringify(RUN_OF_NIGHT)).not.toContain('Wednesday');
  });
});
