import * as _dateUtil from './date.ts';
import {
  calculateMinimumReleaseAgeMs,
  checkMinimumReleaseAge,
} from './minimum-release-age.ts';
import { toMs } from './pretty-time.ts';
import type { Timestamp } from './timestamp.ts';

vi.mock('./date.ts');
const dateUtil = vi.mocked(_dateUtil);

describe('util/minimum-release-age', () => {
  describe('.calculateMinimumReleaseAgeMs()', () => {
    it('returns 0 if minimumReleaseAge is not set', () => {
      expect(
        calculateMinimumReleaseAgeMs({ minimumReleaseAgeBuffer: '10 minutes' }),
      ).toBe(0);
    });

    it('returns minimumReleaseAge if minimumReleaseAgeBuffer is not set', () => {
      expect(
        calculateMinimumReleaseAgeMs({ minimumReleaseAge: '3 days' }),
      ).toBe(toMs('3 days'));
    });

    it('ignores an invalid minimumReleaseAgeBuffer', () => {
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '3 days',
          minimumReleaseAgeBuffer: 'bananas',
        }),
      ).toBe(toMs('3 days'));
    });

    it('ignores a negative minimumReleaseAgeBuffer', () => {
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '3 days',
          minimumReleaseAgeBuffer: '-10 minutes',
        }),
      ).toBe(toMs('3 days'));
    });

    it('extends minimumReleaseAge by the minimumReleaseAgeBuffer duration', () => {
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '3 days',
          minimumReleaseAgeBuffer: '10 minutes',
        }),
      ).toBe((toMs('3 days') ?? 0) + (toMs('10 minutes') ?? 0));
    });
  });

  describe('.checkMinimumReleaseAge()', () => {
    it('is not pending if minimumReleaseAge is not set', () => {
      const res = checkMinimumReleaseAge(
        {},
        '2021-01-01T00:00:00.000Z' as Timestamp,
      );
      expect(res).toEqual({
        isPending: false,
        minimumReleaseAgeMs: 0,
        hasTimestamp: true,
      });
    });

    it('is pending if the release is younger than minimumReleaseAge', () => {
      dateUtil.getElapsedMs.mockReturnValueOnce(toMs('1 day') ?? 0);
      const res = checkMinimumReleaseAge(
        { minimumReleaseAge: '3 days' },
        '2021-01-01T00:00:00.000Z' as Timestamp,
      );
      expect(res).toEqual({
        isPending: true,
        minimumReleaseAgeMs: toMs('3 days'),
        hasTimestamp: true,
      });
    });

    it('is not pending if the release is older than minimumReleaseAge', () => {
      dateUtil.getElapsedMs.mockReturnValueOnce(toMs('5 days') ?? 0);
      const res = checkMinimumReleaseAge(
        { minimumReleaseAge: '3 days' },
        '2021-01-01T00:00:00.000Z' as Timestamp,
      );
      expect(res).toEqual({
        isPending: false,
        minimumReleaseAgeMs: toMs('3 days'),
        hasTimestamp: true,
      });
    });

    it('is pending if the release is older than minimumReleaseAge but within the minimumReleaseAgeBuffer', () => {
      dateUtil.getElapsedMs.mockReturnValueOnce((toMs('3 days') ?? 0) + 1);
      const res = checkMinimumReleaseAge(
        { minimumReleaseAge: '3 days', minimumReleaseAgeBuffer: '10 minutes' },
        '2021-01-01T00:00:00.000Z' as Timestamp,
      );
      expect(res).toEqual({
        isPending: true,
        minimumReleaseAgeMs: (toMs('3 days') ?? 0) + (toMs('10 minutes') ?? 0),
        hasTimestamp: true,
      });
    });

    it('is not pending if the release is older than minimumReleaseAge plus the minimumReleaseAgeBuffer', () => {
      dateUtil.getElapsedMs.mockReturnValueOnce(toMs('4 days') ?? 0);
      const res = checkMinimumReleaseAge(
        { minimumReleaseAge: '3 days', minimumReleaseAgeBuffer: '10 minutes' },
        '2021-01-01T00:00:00.000Z' as Timestamp,
      );
      expect(res).toEqual({
        isPending: false,
        minimumReleaseAgeMs: (toMs('3 days') ?? 0) + (toMs('10 minutes') ?? 0),
        hasTimestamp: true,
      });
    });

    it('is pending with a missing timestamp if minimumReleaseAgeBehaviour=timestamp-required', () => {
      const res = checkMinimumReleaseAge(
        {
          minimumReleaseAge: '3 days',
          minimumReleaseAgeBehaviour: 'timestamp-required',
        },
        undefined,
      );
      expect(res).toEqual({
        isPending: true,
        minimumReleaseAgeMs: toMs('3 days'),
        hasTimestamp: false,
      });
    });

    it('is not pending with a missing timestamp if minimumReleaseAgeBehaviour=timestamp-optional', () => {
      const res = checkMinimumReleaseAge(
        {
          minimumReleaseAge: '3 days',
          minimumReleaseAgeBehaviour: 'timestamp-optional',
        },
        undefined,
      );
      expect(res).toEqual({
        isPending: false,
        minimumReleaseAgeMs: toMs('3 days'),
        hasTimestamp: false,
      });
    });
  });
});
