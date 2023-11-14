import type { RenovateConfig } from '../../../../config/types';
import * as schedule from './schedule';

describe('workers/repository/update/branch/schedule', () => {
  describe('hasValidTimezone(schedule)', () => {
    it('returns false for invalid timezone', () => {
      expect(schedule.hasValidTimezone('Asia')[0]).toBeFalse();
    });

    it('returns true for valid timezone', () => {
      expect(schedule.hasValidTimezone('Asia/Singapore')[0]).toBeTrue();
    });
  });

  describe('hasValidSchedule(schedule)', () => {
    it('returns true for null', () => {
      expect(schedule.hasValidSchedule(null)[0]).toBeTrue();
    });

    it('returns true for at any time', () => {
      expect(schedule.hasValidSchedule('at any time')[0]).toBeTrue();
    });

    it('returns false for invalid schedule', () => {
      expect(schedule.hasValidSchedule(['foo'])[0]).toBeFalse();
    });

    it('returns false if any schedule fails to parse', () => {
      expect(schedule.hasValidSchedule(['after 5:00pm', 'foo'])[0]).toBeFalse();
    });

    it('returns false if using minutes', () => {
      expect(
        schedule.hasValidSchedule(['every 15 mins every weekday'])[0],
      ).toBeFalse();
    });

    it('returns false for wildcard minutes', () => {
      const res = schedule.hasValidSchedule(['1 * * * *']);
      expect(res).toEqual([
        false,
        `Invalid schedule: "1 * * * *" has cron syntax, but doesn't have * as minutes`,
      ]);
    });

    it('returns false if schedules have no days or time range', () => {
      expect(schedule.hasValidSchedule(['at 5:00pm'])[0]).toBeFalse();
    });

    it('returns false if any schedule has no days or time range', () => {
      expect(schedule.hasValidSchedule(['at 5:00pm', 'on saturday'])[0]).toBe(
        false,
      );
    });

    it('returns false for every xday', () => {
      expect(schedule.hasValidSchedule(['every friday'])[0]).toBeFalse();
    });

    it('returns true if schedule has days of week', () => {
      expect(schedule.hasValidSchedule(['on friday and saturday'])[0]).toBe(
        true,
      );
    });

    it('returns true for multi day schedules', () => {
      expect(
        schedule.hasValidSchedule([
          'after 5:00pm on wednesday and thursday',
        ])[0],
      ).toBeTrue();
    });

    it('returns true if schedule has a start time', () => {
      expect(schedule.hasValidSchedule(['after 8:00pm'])[0]).toBeTrue();
    });

    it('returns true for first day of the month', () => {
      expect(
        schedule.hasValidSchedule(['on the first day of the month'])[0],
      ).toBeTrue();
    });

    it('returns true for schedules longer than 1 month', () => {
      expect(schedule.hasValidSchedule(['every 3 months'])[0]).toBeTrue();
      expect(schedule.hasValidSchedule(['every 6 months'])[0]).toBeTrue();
      expect(schedule.hasValidSchedule(['every 12 months'])[0]).toBeTrue();
    });

    it('returns true if schedule has an end time', () => {
      expect(schedule.hasValidSchedule(['before 6:00am'])[0]).toBeTrue();
    });

    it('returns true if schedule has a start and end time', () => {
      expect(
        schedule.hasValidSchedule(['after 11:00pm and before 6:00am'])[0],
      ).toBeTrue();
    });

    it('returns true if schedule has days and a start and end time', () => {
      expect(
        schedule.hasValidSchedule([
          'after 11:00pm and before 6:00am every weekday',
        ])[0],
      ).toBeTrue();
    });

    it('returns true if schedule uses cron syntax', () => {
      expect(schedule.hasValidSchedule(['* 5 * * *'])[0]).toBeTrue();
      expect(schedule.hasValidSchedule(['* * * * * 6L'])[0]).toBeTrue();
      expect(schedule.hasValidSchedule(['* * */2 6#1'])[0]).toBeTrue();
    });

    it('massages schedules', () => {
      expect(
        schedule.hasValidSchedule([
          'before 5am on the first day of the month',
        ])[0],
      ).toBeTrue();
      expect(schedule.hasValidSchedule(['every month'])[0]).toBeTrue();
    });

    it('supports hours shorthand', () => {
      const [res] = schedule.hasValidSchedule([
        'after 11pm and before 6am every weekend',
        'after 11pm',
        'after 10pm and before 5:00am',
        'after 10pm and before 5am every weekday',
        'after 11pm and before 6am',
        'after 9pm on friday and saturday',
        'before 5am every weekday',
        'every weekend',
      ]);
      expect(res).toBeTrue();
    });
  });

  describe('isScheduledNow(config)', () => {
    let config: RenovateConfig;

    beforeAll(() => {
      jest.useFakeTimers();
    });

    beforeEach(() => {
      jest.setSystemTime(new Date('2017-06-30T10:50:00.000')); // Locally 2017-06-30 10:50am

      config = {};
    });

    it('returns true if no schedule', () => {
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('returns true if at any time', () => {
      config.schedule = 'at any time' as never;
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('returns true if at any time array', () => {
      config.schedule = ['at any time'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('returns true if invalid schedule', () => {
      config.schedule = ['every 15 minutes'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('returns true if invalid timezone', () => {
      config.schedule = ['after 4:00pm'];
      config.timezone = 'Asia';
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports before hours true', () => {
      config.schedule = ['before 4:00pm'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports before hours false', () => {
      config.schedule = ['before 4:00am'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('massages string', () => {
      config.schedule = 'before 4:00am' as never;
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports outside hours', () => {
      config.schedule = ['after 4:00pm'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports cron syntax with hours', () => {
      config.schedule = ['* 10 * * *'];
      let res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();

      config.schedule = ['* 11 * * *'];
      res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports cron syntax with days', () => {
      config.schedule = ['* * 30 * *'];
      let res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();

      config.schedule = ['* * 1 * *'];
      res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports cron syntax with months', () => {
      config.schedule = ['* * * 6 *'];
      let res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();

      config.schedule = ['* * * 7 *'];
      res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports cron syntax with weekdays', () => {
      config.schedule = ['* * * * 5'];
      let res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();

      config.schedule = ['* * * * 6'];
      res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    describe('supports cron syntax on Sundays', () => {
      beforeEach(() => {
        jest.setSystemTime(new Date('2023-01-08T10:50:00.000')); // Locally Sunday 8 January 2023 10:50am
      });

      it('approves if the weekday is *', () => {
        config.schedule = ['* * * * *'];
        const res = schedule.isScheduledNow(config);
        expect(res).toBeTrue();
      });

      it('approves if the weekday is 0', () => {
        config.schedule = ['* * * * 0'];
        const res = schedule.isScheduledNow(config);
        expect(res).toBeTrue();
      });

      it('rejects if the weekday is 1', () => {
        config.schedule = ['* * * * 1'];
        const res = schedule.isScheduledNow(config);
        expect(res).toBeFalse();
      });
    });

    describe('supports timezone', () => {
      it.each`
        sched                     | tz                  | datetime                          | expected
        ${'after 4pm'}            | ${'Asia/Singapore'} | ${'2017-06-30T15:59:00.000+0800'} | ${false}
        ${'after 4pm'}            | ${'Asia/Singapore'} | ${'2017-06-30T16:01:00.000+0800'} | ${true}
        ${'before 4am on Monday'} | ${'Asia/Tokyo'}     | ${'2017-06-26T03:59:00.000+0900'} | ${true}
        ${'before 4am on Monday'} | ${'Asia/Tokyo'}     | ${'2017-06-26T04:01:00.000+0900'} | ${false}
      `('$sched, $tz, $datetime', ({ sched, tz, datetime, expected }) => {
        config.schedule = [sched];
        config.timezone = tz;
        jest.setSystemTime(new Date(datetime));
        expect(schedule.isScheduledNow(config)).toBe(expected);
      });
    });

    it('supports multiple schedules', () => {
      config.schedule = ['after 4:00pm', 'before 11:00am'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports day match', () => {
      config.schedule = ['on friday and saturday'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports day mismatch', () => {
      config.schedule = ['on monday and tuesday'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports every weekday', () => {
      config.schedule = ['every weekday'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports every weekend', () => {
      config.schedule = ['every weekend'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports every weekday with time', () => {
      config.schedule = ['before 11:00am every weekday'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('supports o every weekday', () => {
      config.schedule = ['before 11:00am on inevery weekday'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('rejects first day of the month', () => {
      config.schedule = ['before 11am on the first day of the month'];
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('approves first day of the month', () => {
      config.schedule = ['before 11am on the first day of the month'];
      jest.setSystemTime(new Date('2017-10-01T05:26:06.000')); // Locally Sunday, 1 October 2017 05:26:06
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('approves valid weeks of year', () => {
      config.schedule = ['every 2 weeks of the year before 08:00 on Monday'];
      jest.setSystemTime(new Date('2017-01-02T06:00:00.000')); // Locally Monday, 2 January 2017 6am (first Monday of the year)
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('rejects on weeks of year', () => {
      config.schedule = ['every 2 weeks of the year before 08:00 on Monday'];
      jest.setSystemTime(new Date('2017-01-09T06:00:00.000')); // Locally Monday, 2 January 2017 6am (second Monday of the year)
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('approves on months of year', () => {
      config.schedule = ['of January'];
      jest.setSystemTime(new Date('2017-01-02T06:00:00.000')); // Locally Monday, 2 January 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('rejects on months of year', () => {
      config.schedule = ['of January'];
      jest.setSystemTime(new Date('2017-02-02T06:00:00.000')); // Locally Thursday, 2 February 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('approves schedule longer than 1 month', () => {
      config.schedule = ['every 3 months'];
      jest.setSystemTime(new Date('2017-07-01T06:00:00.000')); // Locally Saturday, 1 July 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('rejects schedule longer than 1 month', () => {
      config.schedule = ['every 6 months'];
      jest.setSystemTime(new Date('2017-02-01T06:00:00.000')); // Locally Thursday, 2 February 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('approves schedule longer than 1 month with day of month', () => {
      config.schedule = ['every 3 months on the first day of the month'];
      jest.setSystemTime(new Date('2017-07-01T06:00:00.000')); // Locally Saturday, 1 July 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeTrue();
    });

    it('rejects schedule longer than 1 month with day of month', () => {
      config.schedule = ['every 3 months on the first day of the month'];
      jest.setSystemTime(new Date('2017-02-01T06:00:00.000')); // Locally Thursday, 2 February 2017 6am
      const res = schedule.isScheduledNow(config);
      expect(res).toBeFalse();
    });

    it('supports weekday instances', () => {
      config.schedule = ['on Monday on the first day instance'];

      const cases: [string, boolean][] = [
        ['2017-02-01T06:00:00.000', false], // Locally Thursday, 2 February 2017 6am
        ['2017-02-06T06:00:00.000', true], // Locally Monday, 6 February 2017 6am
        ['2017-02-13T06:00:00.000', false], // Locally Monday, 13 February 2017 6am
      ];

      cases.forEach(([datetime, expected]) => {
        jest.setSystemTime(new Date(datetime));
        expect(schedule.isScheduledNow(config)).toBe(expected);
      });
    });
  });
});
