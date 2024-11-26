import { isScheduledNow } from '../../../workers/repository/update/branch/schedule';
import type { RenovateConfig } from '../../types';
import { presets } from './schedule';

describe('config/presets/internal/schedule', () => {
  let config: RenovateConfig;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(new Date('2017-06-30T10:50:00.000')); // Locally 2017-06-30 10:50am

    config = {};
  });

  describe('daily', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-30T00:50:00.000'} | ${true}
      ${'2017-06-30T01:50:00.000'} | ${true}
      ${'2017-06-30T02:50:00.000'} | ${true}
      ${'2017-06-30T03:50:00.000'} | ${true}
      ${'2017-06-30T04:50:00.000'} | ${false}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.daily.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('earlyMondays', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-26T00:50:00.000'} | ${true}
      ${'2017-06-26T01:50:00.000'} | ${true}
      ${'2017-06-26T02:50:00.000'} | ${true}
      ${'2017-06-26T03:50:00.000'} | ${true}
      ${'2017-06-26T04:50:00.000'} | ${false}
      ${'2017-06-30T00:50:00.000'} | ${false}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.earlyMondays.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('monthly', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-01T00:50:00.000'} | ${true}
      ${'2017-06-01T01:50:00.000'} | ${true}
      ${'2017-06-01T02:50:00.000'} | ${true}
      ${'2017-06-01T03:50:00.000'} | ${true}
      ${'2017-06-01T04:50:00.000'} | ${false}
      ${'2017-06-02T00:50:00.000'} | ${false}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.monthly.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('nonOfficeHours', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-01T00:50:00.000'} | ${true}
      ${'2017-06-01T01:50:00.000'} | ${true}
      ${'2017-06-01T02:50:00.000'} | ${true}
      ${'2017-06-01T03:50:00.000'} | ${true}
      ${'2017-06-01T04:50:00.000'} | ${true}
      ${'2017-06-01T10:50:00.000'} | ${false}
      ${'2017-06-01T11:50:00.000'} | ${false}
      ${'2017-06-01T22:50:00.000'} | ${true}
      ${'2017-06-01T23:50:00.000'} | ${true}
      ${'2017-06-03T09:50:00.000'} | ${true}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.nonOfficeHours.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  // const weekdays = ['every weekday'];
  // const weekends = ['every weekend'];
  // const yearly = ['every 12 months on the first day of the month'];
  describe('quarterly', () => {
    it.each`
      datetime                     | expected
      ${'2017-01-01T00:50:00.000'} | ${true}
      ${'2017-04-01T01:50:00.000'} | ${true}
      ${'2017-07-01T02:50:00.000'} | ${true}
      ${'2017-10-01T03:50:00.000'} | ${true}
      ${'2017-02-01T04:50:00.000'} | ${false}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.quarterly.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('weekdays', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-01T00:50:00.000'} | ${true}
      ${'2017-06-02T01:50:00.000'} | ${true}
      ${'2017-06-03T02:50:00.000'} | ${false}
      ${'2017-06-04T03:50:00.000'} | ${false}
      ${'2017-06-05T04:50:00.000'} | ${true}
      ${'2017-06-06T10:50:00.000'} | ${true}
      ${'2017-06-07T11:50:00.000'} | ${true}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.weekdays.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('weekends', () => {
    it.each`
      datetime                     | expected
      ${'2017-06-01T00:50:00.000'} | ${false}
      ${'2017-06-02T01:50:00.000'} | ${false}
      ${'2017-06-03T02:50:00.000'} | ${true}
      ${'2017-06-04T03:50:00.000'} | ${true}
      ${'2017-06-05T04:50:00.000'} | ${false}
      ${'2017-06-06T10:50:00.000'} | ${false}
      ${'2017-06-07T11:50:00.000'} | ${false}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.weekends.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });

  describe('yearly', () => {
    it.each`
      datetime                     | expected
      ${'2017-01-01T00:50:00.000'} | ${true}
      ${'2017-02-02T01:50:00.000'} | ${false}
      ${'2018-01-01T02:50:00.000'} | ${true}
    `('$datetime', ({ datetime, expected }) => {
      config.schedule = presets.yearly.schedule;
      jest.setSystemTime(new Date(datetime));
      expect(isScheduledNow(config)).toBe(expected);
    });
  });
});
