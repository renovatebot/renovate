const schedule = require('../../../lib/workers/package/schedule');
const logger = require('../../_fixtures/logger');

describe('workers/package/schedule', () => {
  describe('hasValidSchedule', () => {
    it('returns false if schedule is not an array', () => {
      expect(schedule.hasValidSchedule({ a: 1 }, logger)).toBe(false);
    });
    it('returns false if schedule array is empty', () => {
      expect(schedule.hasValidSchedule([], logger)).toBe(false);
    });
    it('returns false if only schedule is empty', () => {
      expect(schedule.hasValidSchedule([''], logger)).toBe(false);
    });
    it('returns false if schedules fail to parse', () => {
      expect(schedule.hasValidSchedule(['foo', 'bar'], logger)).toBe(false);
    });
    it('returns false if schedules have no days or time range', () => {
      expect(schedule.hasValidSchedule(['foo', 'at 5:00pm'], logger)).toBe(
        false
      );
    });
    it('returns true if any schedule has days of week', () => {
      expect(
        schedule.hasValidSchedule(['foo', 'on friday and saturday'], logger)
      ).toBe(true);
    });
    it('returns true if schedule has a start time', () => {
      expect(schedule.hasValidSchedule(['after 8:00pm'], logger)).toBe(true);
    });
    it('returns true if schedule has an end time', () => {
      expect(schedule.hasValidSchedule(['before 6:00am'], logger)).toBe(true);
    });
    it('returns true if schedule has a start and end time', () => {
      expect(
        schedule.hasValidSchedule(['after 11:00pm and before 6:00am'], logger)
      ).toBe(true);
    });
    it('returns true if schedule has days and a start and end time', () => {
      expect(
        schedule.hasValidSchedule(
          ['after 11:00pm and before 6:00am every weekday'],
          logger
        )
      ).toBe(true);
    });
  });
});
