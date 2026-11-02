import * as _dateUtil from './date.ts';
import type {
  PackageManagerMinimumReleaseAgeConfig,
  PackageManagerMinimumReleaseAgeOptions,
} from './minimum-release-age.ts';
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

    describe('with an ISO 8601 date as minimumReleaseAgeExtracted', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each`
        minimumReleaseAge | minimumReleaseAgeExtracted    | expected
        ${'1 day'}        | ${'2026-06-12T12:00:00.000Z'} | ${'3 days'}
        ${'5 days'}       | ${'2026-06-12T12:00:00.000Z'} | ${'5 days'}
        ${undefined}      | ${'2026-06-12'}               | ${'3.5 days'}
        ${'1 day'}        | ${'2026-06-20T00:00:00.000Z'} | ${'1 day'}
        ${'1 day'}        | ${'2026-13-99T00:00:00.000Z'} | ${'1 day'}
      `(
        'uses the time elapsed since minimumReleaseAgeExtracted=$minimumReleaseAgeExtracted',
        ({ minimumReleaseAge, minimumReleaseAgeExtracted, expected }) => {
          expect(
            calculateMinimumReleaseAgeMs({
              minimumReleaseAge,
              minimumReleaseAgeExtracted,
            }),
          ).toBe(toMs(expected));
        },
      );

      it('grows the age of a date over time', () => {
        const config = {
          minimumReleaseAgeExtracted: '2026-06-12T12:00:00.000Z',
        };

        vi.setSystemTime(new Date('2026-06-22T12:00:00.000Z'));

        expect(calculateMinimumReleaseAgeMs(config)).toBe(toMs('10 days'));
      });
    });

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
    const manager = 'poetry';
    const packageFile = 'pyproject.toml';
    const update = {
      manager,
      packageFile,
      minimumReleaseAge: '2 weeks',
      minimumReleaseAgeRepository: '3 days',
    };

    function calculate(
      upgrades: PackageManagerMinimumReleaseAgeConfig[],
      config: PackageManagerMinimumReleaseAgeOptions['config'] = {},
    ): number {
      return calculatePackageManagerMinimumReleaseAgeMs({
        config,
        manager,
        packageFile,
        upgrades,
      });
    }

    it('returns 0 without minimumReleaseAgeRepository', () => {
      expect(calculate([], { minimumReleaseAge: '3 days' })).toBe(0);
    });

    it('returns minimumReleaseAgeRepository of the config without upgrades', () => {
      expect(calculate([], update)).toBe(toMs('3 days'));
    });

    it('returns minimumReleaseAgeRepository of the first upgrade', () => {
      expect(
        calculate([
          update,
          { ...update, minimumReleaseAgeRepository: '1 week' },
        ]),
      ).toBe(toMs('3 days'));
    });

    it('returns minimumReleaseAgeRepository of the first upgrade of the manager', () => {
      expect(
        calculate(
          [
            {
              manager: 'pep621',
              packageFile,
              minimumReleaseAgeRepository: '1 week',
            },
            { ...update, minimumReleaseAgePackageManager: '5 days' },
          ],
          { minimumReleaseAgeRepository: '2 weeks' },
        ),
      ).toBe(toMs('5 days'));
    });

    it('reads the upgrade of the manager and package file from the branch config without upgrades', () => {
      expect(
        calculate([], {
          isLockFileMaintenance: true,
          manager: 'npm',
          minimumReleaseAge: '1 day',
          minimumReleaseAgePackageManager: '1 week',
          upgrades: [
            {
              isLockFileMaintenance: true,
              manager: 'npm',
              packageFile: 'package.json',
              minimumReleaseAge: '1 day',
              minimumReleaseAgePackageManager: '1 week',
            },
            {
              ...update,
              isLockFileMaintenance: true,
              packageFile: 'other/pyproject.toml',
              minimumReleaseAge: '1 day',
            },
            { ...update, isLockFileMaintenance: true },
          ],
        }),
      ).toBe(toMs('2 weeks'));
    });

    it('reads the branch config if no upgrade belongs to the manager', () => {
      expect(
        calculate(
          [
            {
              manager: 'pep621',
              packageFile,
              minimumReleaseAgeRepository: '1 week',
            },
          ],
          { minimumReleaseAgeRepository: '5 days', upgrades: [] },
        ),
      ).toBe(toMs('5 days'));
    });

    it('returns minimumReleaseAge for lock file maintenance', () => {
      expect(calculate([], { ...update, isLockFileMaintenance: true })).toBe(
        toMs('2 weeks'),
      );
    });

    it('returns 0 for lock file maintenance without minimumReleaseAge', () => {
      expect(
        calculate([
          {
            ...update,
            isLockFileMaintenance: true,
            minimumReleaseAge: null,
          },
        ]),
      ).toBe(0);
    });

    it('returns 0 if an upgrade is a security update', () => {
      expect(
        calculate([update, { ...update, isVulnerabilityAlert: true }], update),
      ).toBe(0);
    });

    it('returns 0 if an upgrade of another manager is a security update', () => {
      expect(
        calculate([
          { manager: 'pep621', packageFile, isVulnerabilityAlert: true },
          update,
        ]),
      ).toBe(0);
    });

    it('returns 0 if the branch config is a security update', () => {
      expect(calculate([], { ...update, isVulnerabilityAlert: true })).toBe(0);
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
          calculate([{ ...update, minimumReleaseAgePackageManager }]),
        ).toBe(toMs(expected));
      },
    );

    it('returns minimumReleaseAgePackageManager without minimumReleaseAgeRepository', () => {
      expect(calculate([], { minimumReleaseAgePackageManager: '5 days' })).toBe(
        toMs('5 days'),
      );
    });

    it('raises minimumReleaseAge of lock file maintenance to minimumReleaseAgePackageManager', () => {
      expect(
        calculate([
          update,
          {
            manager,
            isLockFileMaintenance: true,
            minimumReleaseAge: '1 day',
            minimumReleaseAgePackageManager: '4 days',
          },
        ]),
      ).toBe(toMs('4 days'));
    });

    it('keeps a larger minimumReleaseAge of lock file maintenance', () => {
      expect(
        calculate([], {
          ...update,
          isLockFileMaintenance: true,
          minimumReleaseAgePackageManager: '4 days',
        }),
      ).toBe(toMs('2 weeks'));
    });

    it('returns 0 for a security update with minimumReleaseAgePackageManager', () => {
      expect(
        calculate([
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
