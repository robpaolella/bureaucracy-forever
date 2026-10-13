import { describe, expect, it } from 'vitest';
import { RAID_WEEK, SCHEDULE_ASIDES, SCHEDULE_HEAD } from './schedule';

describe('schedule copy', () => {
  it('uses the approved Raiding intro word for word', () => {
    expect(SCHEDULE_HEAD.lede).toBe(
      "We'll post our raid days and times here soon. Each one will show in your own time zone, so you'll always know when raid starts where you are.",
    );
  });

  it('has Attendance, Sign-ups and Loot rows with the approved wording, and no link', () => {
    expect(SCHEDULE_ASIDES).toEqual([
      { title: 'Attendance', text: "Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." },
      { title: 'Sign-ups', text: 'Sign up for each raid as Accept, Tentative or Absent, on the calendar or with our bot in Discord.' },
      { title: 'Loot', text: 'Loot runs on hard reserve, then soft reserve, then open roll.' },
    ]);
  });

  it('keeps the week slots unchanged', () => {
    expect(RAID_WEEK.map((s) => s.day)).toEqual(['Day 1', 'Day 2', 'Optional Day']);
  });
});
