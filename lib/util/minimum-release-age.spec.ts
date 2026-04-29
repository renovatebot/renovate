import { DateTime } from 'luxon';
import {
  checkMinimumReleaseAge,
  getMinimumReleaseAgeMs,
} from './minimum-release-age.ts';

describe('util/minimum-release-age', () => {
  const t0 = DateTime.fromISO('2020-10-10', { zone: 'utc' });

  beforeAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(() => {
    vi.setSystemTime(t0.toMillis());
  });

  describe('getMinimumReleaseAgeMs', () => {
    it('returns 0 when minimumReleaseAge is empty', () => {
      expect(getMinimumReleaseAgeMs(undefined)).toBe(0);
      expect(getMinimumReleaseAgeMs('')).toBe(0);
    });

    it('returns 0 when minimumReleaseAge is unparseable', () => {
      expect(getMinimumReleaseAgeMs('not a duration')).toBe(0);
    });

    it('returns the parsed duration in milliseconds', () => {
      expect(getMinimumReleaseAgeMs('3 days')).toBe(3 * 24 * 60 * 60 * 1000);
    });
  });

  describe('checkMinimumReleaseAge', () => {
    it('returns allowed when minimumReleaseAge is not set', () => {
      const release = { releaseTimestamp: t0.minus({ hours: 1 }).toISO()! };
      expect(
        checkMinimumReleaseAge(release, { minimumReleaseAge: undefined }),
      ).toBe('allowed');
    });

    it('returns allowed when release age is greater than minimum', () => {
      const release = { releaseTimestamp: t0.minus({ days: 5 }).toISO()! };
      expect(
        checkMinimumReleaseAge(release, { minimumReleaseAge: '3 days' }),
      ).toBe('allowed');
    });

    it('returns pending-elapsed when release age is less than minimum', () => {
      const release = { releaseTimestamp: t0.minus({ hours: 12 }).toISO()! };
      expect(
        checkMinimumReleaseAge(release, { minimumReleaseAge: '3 days' }),
      ).toBe('pending-elapsed');
    });

    it('returns pending-no-timestamp when timestamp is required and missing', () => {
      expect(
        checkMinimumReleaseAge(
          {},
          {
            minimumReleaseAge: '3 days',
            minimumReleaseAgeBehaviour: 'timestamp-required',
          },
        ),
      ).toBe('pending-no-timestamp');
    });

    it('returns pending-no-timestamp when behaviour defaults to timestamp-required', () => {
      expect(
        checkMinimumReleaseAge({}, { minimumReleaseAge: '3 days' }),
      ).toBe('pending-no-timestamp');
    });

    it('returns allowed-no-timestamp when timestamp is optional and missing', () => {
      expect(
        checkMinimumReleaseAge(
          {},
          {
            minimumReleaseAge: '3 days',
            minimumReleaseAgeBehaviour: 'timestamp-optional',
          },
        ),
      ).toBe('allowed-no-timestamp');
    });

    it('returns allowed when timestamp is optional and minimumReleaseAge is unset', () => {
      expect(
        checkMinimumReleaseAge(
          {},
          {
            minimumReleaseAge: undefined,
            minimumReleaseAgeBehaviour: 'timestamp-optional',
          },
        ),
      ).toBe('allowed');
    });
  });
});
