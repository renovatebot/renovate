const mockDate = require('mockdate');
const schedule = require('../../../lib/workers/branch/schedule');
const logger = require('../../_fixtures/logger');

describe('workers/branch/schedule', () => {
  describe('hasValidSchedule(schedule)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('returns false if schedule is not an array', () => {
      expect(schedule.hasValidSchedule({ a: 1 }, logger)).toBe(false);
    });
    it('returns false if schedule array is empty', () => {
      expect(schedule.hasValidSchedule([], logger)).toBe(false);
    });
    it('returns false if only schedule is empty', () => {
      expect(schedule.hasValidSchedule([''], logger)).toBe(false);
    });
    it('returns false for invalid schedule', () => {
      expect(schedule.hasValidSchedule(['foo'], logger)).toBe(false);
    });
    it('returns false if any schedule fails to parse', () => {
      expect(schedule.hasValidSchedule(['after 5:00pm', 'foo'], logger)).toBe(
        false
      );
    });
    it('returns false if schedules have no days or time range', () => {
      expect(schedule.hasValidSchedule(['at 5:00pm'], logger)).toBe(false);
    });
    it('returns false if any schedule has no days or time range', () => {
      expect(
        schedule.hasValidSchedule(['at 5:00pm', 'on saturday'], logger)
      ).toBe(false);
    });
    it('returns true if schedule has days of week', () => {
      expect(
        schedule.hasValidSchedule(['on friday and saturday'], logger)
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
    it('supports hours shorthand', () => {
      const res = schedule.hasValidSchedule(
        [
          'after 11pm and before 6am every weekend',
          'after 11pm',
          'after 10pm and before 5:00am',
          'after 10pm and before 5am every weekday',
          'after 11pm and before 6am',
          'after 9pm on friday and saturday',
          'before 5am every weekday',
          'every weekend',
        ],
        logger
      );
      expect(res).toBe(true);
    });
  });
  describe('isScheduledNow(config)', () => {
    let config;
    beforeEach(() => {
      mockDate.set(1498812608678); // 2017-06-30 10:50am
      jest.resetAllMocks();
      config = {
        logger,
      };
    });
    it('returns true if no schedule', () => {
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(true);
    });
    it('supports before hours true', () => {
      config.schedule = 'before 4:00pm';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(true);
    });
    it('supports before hours false', () => {
      config.schedule = 'before 4:00am';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(false);
    });
    it('supports outside hours', () => {
      config.schedule = 'after 4:00pm';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(false);
    });
    it('supports timezone', () => {
      config.schedule = 'after 4:00pm';
      config.timezone = 'Asia/Singapore';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(true);
    });
    it('supports multiple schedules', () => {
      config.schedule = ['after 4:00pm', 'before 11:00am'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(true);
    });
    it('supports day match', () => {
      config.schedule = 'on friday and saturday';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(true);
    });
    it('supports day mismatch', () => {
      config.schedule = 'on monday and tuesday';
      const res = schedule.isScheduledNow(config);
      expect(res).toBe(false);
    });
  });
});
