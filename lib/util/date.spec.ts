import { DateTime } from 'luxon';
import {
  getElapsedDays,
  getElapsedHours,
  getElapsedMinutes,
  getElapsedMs,
} from './date';

describe('util/date', () => {
  const t0 = DateTime.fromISO('2020-10-10', { zone: 'utc' });

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(t0.toMillis());
  });

  describe('getElapsedDays', () => {
    it('returns elapsed days', () => {
      const t = t0.minus({ days: 42 });
      expect(getElapsedDays(t.toISO()!)).toBe(42);
    });
  });

  describe('getElapsedMinutes', () => {
    it('returns elapsed minutes', () => {
      const t = t0.minus({ minutes: 42 });
      expect(getElapsedMinutes(t.toJSDate())).toBe(42);
    });
  });

  describe('getElapsedHours', () => {
    it('returns elapsed hours', () => {
      const t = t0.minus({ hours: 42 });
      expect(getElapsedHours(t.toISO()!)).toBe(42); // ISOstring
      expect(getElapsedHours(t.toJSDate())).toBe(42); // JS Date
    });

    it('returns zero when date passed is invalid', () => {
      expect(getElapsedHours(new Date('invalid_date_string'))).toBe(0);
    });
  });

  describe('getElapsedMs', () => {
    it('returns elapsed time in milliseconds', () => {
      const t = t0.minus({ milliseconds: 42 });
      expect(getElapsedMs(t.toISO()!)).toBe(42);
    });
  });
});
