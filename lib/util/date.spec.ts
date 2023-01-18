import { getElapsedDays, getElapsedHours, getElapsedMinutes } from './date';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

describe('util/date', () => {
  const Jan1 = new Date(new Date().getFullYear(), 0, 1);

  describe('getElapsedDays', () => {
    it('returns elapsed days', () => {
      const elapsedDays = Math.floor(
        (new Date().getTime() - new Date(Jan1).getTime()) / ONE_DAY_MS
      );
      expect(getElapsedDays(Jan1.toDateString())).toBe(elapsedDays);
    });

    it('throws when invalid date is passed', () => {
      expect(() => getElapsedDays('invalid_date_string')).toThrow();
    });
  });

  describe('getElapsedHours', () => {
    it('returns elapsed hours', () => {
      const elapsedHours = Math.floor(
        (new Date().getTime() - new Date(Jan1).getTime()) / ONE_HOUR_MS
      );
      expect(getElapsedHours(Jan1)).toBe(elapsedHours);
    });

    it('throws when invalid date is passed', () => {
      expect(() => getElapsedHours('invalid_date_string')).toThrow();
    });
  });

  describe('getElapsedMinutes', () => {
    it('returns elapsed minutes', () => {
      const elapsedMinutes = Math.floor(
        (new Date().getTime() - new Date(Jan1).getTime()) / ONE_MINUTE_MS
      );
      expect(getElapsedMinutes(new Date(Jan1))).toBe(elapsedMinutes);
    });

    it('throws when invalid date is passed', () => {
      expect(() =>
        getElapsedMinutes(new Date('invalid_date_string'))
      ).toThrow();
    });
  });
});
