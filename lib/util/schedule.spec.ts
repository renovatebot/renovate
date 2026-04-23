import { getReadableCronSchedule } from './schedule.ts';

describe('util/schedule', () => {
  describe('getReadableCronSchedule', () => {
    it('returns null for non-cron (Later.js) schedule', () => {
      expect(getReadableCronSchedule(['before 5am on Monday'])).toBeNull();
    });

    it('returns null for "at any time"', () => {
      expect(getReadableCronSchedule(['at any time'])).toBeNull();
    });

    it('converts a simple daily cron expression', () => {
      expect(getReadableCronSchedule(['* 5 * * *'])).toEqual([
        'Between 05:00 AM and 05:59 AM (`* 5 * * *`)',
      ]);
    });

    it('converts a weekly cron expression', () => {
      expect(getReadableCronSchedule(['* 5 * * 1'])).toEqual([
        'Between 05:00 AM and 05:59 AM, only on Monday (`* 5 * * 1`)',
      ]);
    });

    it('converts multiple cron expressions', () => {
      expect(getReadableCronSchedule(['* 5 * * 1', '* 5 * * 3'])).toEqual([
        'Between 05:00 AM and 05:59 AM, only on Monday (`* 5 * * 1`)',
        'Between 05:00 AM and 05:59 AM, only on Wednesday (`* 5 * * 3`)',
      ]);
    });

    it('strips leading "Every minute, " prefix from cronstrue output', () => {
      const result = getReadableCronSchedule(['* * * * 1']);
      expect(result).not.toBeNull();
      expect(result![0]).not.toContain('Every minute,');
    });

    it('capitalizes the first letter of the description', () => {
      const result = getReadableCronSchedule(['* 5 * * *']);
      expect(result![0][0]).toBe(result![0][0].toUpperCase());
    });
  });
});
