import { DateTime } from 'luxon';
import { ReleaseAgeMatcher } from './release-age';

describe('util/package-rules/release-age', () => {
  const matcher = new ReleaseAgeMatcher();

  describe('match', () => {
    const t0 = DateTime.fromISO('2023-07-07', { zone: 'utc' });

    beforeAll(() => {
      jest.useFakeTimers();
    });

    beforeEach(() => {
      jest.setSystemTime(t0.toMillis());
    });

    it('returns false if release is older', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchReleaseAge: '< 1 year', // younger than 1 year
        },
      );
      expect(result).toBeFalse();
    });

    it('returns false if release is younger', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchReleaseAge: '> 10 years', // older than 10 yrs
        },
      );
      expect(result).toBeFalse();
    });

    it('returns null if release invalid', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: 'abc',
        },
        {
          matchReleaseAge: '> 2 days', // older than 2 days
        },
      );
      expect(result).toBeNull();
    });

    it('returns false if release undefined', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: undefined,
        },
        {
          matchReleaseAge: '> 2 days', // older than 2 days
        },
      );
      expect(result).toBeFalse();
    });

    it('returns false if release null', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: null,
        },
        {
          matchReleaseAge: '> 2 days', // older than 2 days
        },
      );
      expect(result).toBeFalse();
    });

    it('returns true if age matches', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchReleaseAge: '> 3 years', // older than 3 years
        },
      );
      expect(result).toBeTrue();
    });
  });
});
