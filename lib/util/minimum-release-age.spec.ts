import * as _dateUtil from './date.ts';
import {
  calculateMinimumReleaseAgeMs,
  calculatePackageManagerMinimumReleaseAgeMs,
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

    it('ignores minimumReleaseAgeExtracted for security updates', () => {
      expect(
        calculateMinimumReleaseAgeMs({
          isVulnerabilityAlert: true,
          minimumReleaseAge: '1 day',
          minimumReleaseAgeExtracted: '3 days',
        }),
      ).toBe(toMs('1 day'));
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
    it.each`
      minimumReleaseAge | minimumReleaseAgeExtracted | expected
      ${'3 days'}       | ${'1 day'}                 | ${'3 days'}
      ${'1 day'}        | ${'3 days'}                | ${'3 days'}
      ${null}           | ${'3 days'}                | ${'3 days'}
      ${undefined}      | ${'3 days'}                | ${'3 days'}
      ${'3 days'}       | ${'bananas'}               | ${'3 days'}
    `(
      'uses the larger of minimumReleaseAge=$minimumReleaseAge and minimumReleaseAgeExtracted=$minimumReleaseAgeExtracted',
      ({ minimumReleaseAge, minimumReleaseAgeExtracted, expected }) => {
        expect(
          calculateMinimumReleaseAgeMs({
            minimumReleaseAge,
            minimumReleaseAgeExtracted,
          }),
        ).toBe(toMs(expected));
      },
    );

    it('extends minimumReleaseAgeExtracted by the minimumReleaseAgeBuffer duration', () => {
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAgeExtracted: '3 days',
          minimumReleaseAgeBuffer: '10 minutes',
        }),
      ).toBe((toMs('3 days') ?? 0) + (toMs('10 minutes') ?? 0));
    });
  });

  describe('.calculatePackageManagerMinimumReleaseAgeMs()', () => {
    const update = {
      minimumReleaseAge: '2 weeks',
      minimumReleaseAgeRepository: '3 days',
    };

    it('returns 0 without minimumReleaseAgeRepository', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({
          minimumReleaseAge: '3 days',
        }),
      ).toBe(0);
    });

    it('returns minimumReleaseAgeRepository of the config without upgrades', () => {
      expect(calculatePackageManagerMinimumReleaseAgeMs(update, [])).toBe(
        toMs('3 days'),
      );
    });

    it('returns minimumReleaseAgeRepository of the first upgrade', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({}, [
          update,
          { minimumReleaseAgeRepository: '1 week' },
        ]),
      ).toBe(toMs('3 days'));
    });

    it('returns minimumReleaseAge for lock file maintenance', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({
          ...update,
          isLockFileMaintenance: true,
        }),
      ).toBe(toMs('2 weeks'));
    });

    it('returns 0 for lock file maintenance without minimumReleaseAge', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({}, [
          {
            isLockFileMaintenance: true,
            minimumReleaseAge: null,
            minimumReleaseAgeRepository: '3 days',
          },
        ]),
      ).toBe(0);
    });

    it('returns 0 if an upgrade is a security update', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs(update, [
          update,
          { ...update, isVulnerabilityAlert: true },
        ]),
      ).toBe(0);
    });

    it.each`
      minimumReleaseAgePackageManager | expected
      ${'1 week'}                     | ${'1 week'}
      ${'1 day'}                      | ${'3 days'}
      ${null}                         | ${'3 days'}
      ${'bananas'}                    | ${'3 days'}
    `(
      'returns the larger of minimumReleaseAgeRepository and minimumReleaseAgePackageManager=$minimumReleaseAgePackageManager',
      ({ minimumReleaseAgePackageManager, expected }) => {
        expect(
          calculatePackageManagerMinimumReleaseAgeMs({}, [
            { ...update, minimumReleaseAgePackageManager },
          ]),
        ).toBe(toMs(expected));
      },
    );

    it('returns minimumReleaseAgePackageManager without minimumReleaseAgeRepository', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({
          minimumReleaseAgePackageManager: '5 days',
        }),
      ).toBe(toMs('5 days'));
    });

    it('raises minimumReleaseAge of lock file maintenance to minimumReleaseAgePackageManager', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({}, [
          update,
          {
            isLockFileMaintenance: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgePackageManager: '4 days',
          },
        ]),
      ).toBe(toMs('4 days'));
    });

    it('keeps a larger minimumReleaseAge of lock file maintenance', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({
          ...update,
          isLockFileMaintenance: true,
          minimumReleaseAgePackageManager: '4 days',
        }),
      ).toBe(toMs('2 weeks'));
    });

    it('returns 0 for a security update with minimumReleaseAgePackageManager', () => {
      expect(
        calculatePackageManagerMinimumReleaseAgeMs({}, [
          {
            ...update,
            isVulnerabilityAlert: true,
            minimumReleaseAgePackageManager: '1 week',
          },
        ]),
      ).toBe(0);
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

    it('is pending if the release is younger than minimumReleaseAgeExtracted', () => {
      dateUtil.getElapsedMs.mockReturnValueOnce(toMs('2 days') ?? 0);
      const res = checkMinimumReleaseAge(
        { minimumReleaseAge: '1 day', minimumReleaseAgeExtracted: '3 days' },
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
