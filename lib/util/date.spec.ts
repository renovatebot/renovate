import { getElapsedDays, getElapsedHours, getElapsedMinutes } from './date';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

describe('util/date', () => {
  const Jan1 = new Date(new Date().getFullYear(), 0, 1);

  it('returns elapsed days', () => {
    const elapsedDays = Math.floor(
      (new Date().getTime() - new Date(Jan1).getTime()) / ONE_DAY_MS
    );
    expect(getElapsedDays(Jan1.toDateString())).toBe(elapsedDays);
  });

  it('returns elapsed minutes', () => {
    const elapsedMinutes = Math.floor(
      (new Date().getTime() - new Date(Jan1).getTime()) / ONE_MINUTE_MS
    );
    expect(getElapsedMinutes(new Date(Jan1))).toBe(elapsedMinutes);
  });

  describe('getElapsedHours', () => {
    it('returns elapsed hours', () => {
      const elapsedHours = Math.floor(
        (new Date().getTime() - new Date(Jan1).getTime()) / ONE_HOUR_MS
      );
      expect(getElapsedHours(Jan1.toISOString())).toBe(elapsedHours); // ISOstring
      expect(getElapsedHours(Jan1)).toBe(elapsedHours); // JS Date
    });

    it('returns zero when date passed is invalid', () => {
      expect(getElapsedHours(new Date('invalid_date_string'))).toBe(0);
    });
  });
});
