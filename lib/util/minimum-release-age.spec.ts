import * as _dateUtil from './date.ts';
import type {
  PackageManagerMinimumReleaseAgeConfig,
  PackageManagerMinimumReleaseAgeOptions,
} from './minimum-release-age.ts';
import {
  calculateMinimumReleaseAgeMs,
  calculatePackageManagerMinimumReleaseAgeMs,
  checkMinimumReleaseAge,
  getMinimumReleaseAgeExemption,
  isReleaseOldEnough,
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
    const manager = 'poetry';
    const packageFile = 'pyproject.toml';
    const update = {
      manager,
      packageFile,
      minimumReleaseAge: '2 weeks',
      minimumReleaseAgePackageManagerSync: true,
      minimumReleaseAgeRepository: '3 days',
    };

    function calculate(
      upgrades: PackageManagerMinimumReleaseAgeConfig[],
      config: PackageManagerMinimumReleaseAgeOptions['config'] = {},
    ): number | null {
      return calculatePackageManagerMinimumReleaseAgeMs({
        config,
        manager,
        packageFile,
        upgrades,
      });
    }

    it('returns 0 without minimumReleaseAgeRepository', () => {
      expect(
        calculate([], {
          minimumReleaseAge: '3 days',
          minimumReleaseAgePackageManagerSync: true,
        }),
      ).toBe(0);
    });

    describe('without minimumReleaseAgePackageManagerSync', () => {
      const offUpdate = {
        ...update,
        minimumReleaseAgePackageManagerSync: false,
      };

      it('returns null', () => {
        expect(
          calculate([offUpdate], { ...update, minimumReleaseAge: '1 week' }),
        ).toBeNull();
      });

      it('returns null for security updates', () => {
        expect(
          calculate([{ ...offUpdate, isVulnerabilityAlert: true }], {
            isVulnerabilityAlert: true,
            minimumReleaseAge: '1 week',
          }),
        ).toBeNull();
      });

      it('returns null without minimumReleaseAge of the config', () => {
        expect(calculate([], {})).toBeNull();
      });

      it('reads the first upgrade of the manager', () => {
        expect(
          calculate([
            { manager: 'pep621', minimumReleaseAgePackageManagerSync: true },
            offUpdate,
          ]),
        ).toBeNull();
      });
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
            update,
          ],
          { minimumReleaseAgeRepository: '2 weeks' },
        ),
      ).toBe(toMs('3 days'));
    });

    it('reads the upgrade of the manager and package file from the branch config without upgrades', () => {
      expect(
        calculate([], {
          isLockFileMaintenance: true,
          manager: 'npm',
          minimumReleaseAge: '1 day',
          upgrades: [
            {
              isLockFileMaintenance: true,
              manager: 'npm',
              packageFile: 'package.json',
              minimumReleaseAge: '1 day',
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
          {
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAgeRepository: '5 days',
            upgrades: [],
          },
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
  });

  describe('.getMinimumReleaseAgeExemption()', () => {
    const ageMs = toMs('3 days') ?? 0;
    const releaseTimestamp = '2021-01-01T00:00:00.000Z' as Timestamp;
    const update = {
      datasource: 'pypi',
      depName: 'dep1',
      manager: 'poetry',
      minimumReleaseAge: '1 day',
      minimumReleaseAgePackageManagerSync: true,
      releaseTimestamp,
    };

    it('returns the updates whose release is younger than the age', () => {
      dateUtil.getElapsedMs.mockReturnValue(toMs('2 days') ?? 0);

      const upgrades = [
        update,
        { ...update, depName: 'dep2', minimumReleaseAge: null },
        { ...update, depName: 'dep2', minimumReleaseAge: '12 hours' },
      ];

      const res = getMinimumReleaseAgeExemption(
        [...upgrades, { ...update, manager: 'pep621' }],
        'poetry',
        'pypi',
        ageMs,
      );

      expect(res).toEqual({ ageMs: 0, depNames: ['dep1', 'dep2'], upgrades });
    });

    it('returns the updates without release timestamp', () => {
      const upgrade = { ...update, releaseTimestamp: undefined };

      const res = getMinimumReleaseAgeExemption(
        [upgrade],
        'poetry',
        'pypi',
        ageMs,
      );

      expect(res).toEqual({
        ageMs: toMs('1 day'),
        depNames: ['dep1'],
        upgrades: [upgrade],
      });
    });

    it('ignores the minimumReleaseAgeBuffer of the updates', () => {
      dateUtil.getElapsedMs.mockReturnValue(toMs('2 days') ?? 0);

      const upgrades = [
        { ...update, minimumReleaseAgeBuffer: '30 minutes' },
        {
          ...update,
          depName: 'dep2',
          minimumReleaseAge: '71 hours',
          minimumReleaseAgeBuffer: '2 hours',
        },
      ];

      const res = getMinimumReleaseAgeExemption(
        upgrades,
        'poetry',
        'pypi',
        ageMs,
      );

      expect(res).toEqual({
        ageMs: toMs('1 day'),
        depNames: ['dep1', 'dep2'],
        upgrades,
      });
    });

    it('returns null if the release is older than the age', () => {
      dateUtil.getElapsedMs.mockReturnValue(toMs('4 days') ?? 0);

      expect(
        getMinimumReleaseAgeExemption([update], 'poetry', 'pypi', ageMs),
      ).toBe(null);
    });

    it.each`
      name                                             | upgrade
      ${'of another manager'}                          | ${{ ...update, manager: 'pep621' }}
      ${'of another datasource'}                       | ${{ ...update, datasource: 'github-tags' }}
      ${'for lock file maintenance'}                   | ${{ ...update, isLockFileMaintenance: true }}
      ${'for security updates'}                        | ${{ ...update, isVulnerabilityAlert: true }}
      ${'with an own age of the age'}                  | ${{ ...update, minimumReleaseAge: '3 days' }}
      ${'with a larger extracted age'}                 | ${{ ...update, minimumReleaseAgeExtracted: '1 week' }}
      ${'without minimumReleaseAgePackageManagerSync'} | ${{ ...update, minimumReleaseAgePackageManagerSync: false }}
    `('returns null for updates $name', ({ upgrade }) => {
      dateUtil.getElapsedMs.mockReturnValue(toMs('2 days') ?? 0);

      expect(
        getMinimumReleaseAgeExemption([upgrade], 'poetry', 'pypi', ageMs),
      ).toBe(null);
    });

    it('returns null without an age', () => {
      expect(
        getMinimumReleaseAgeExemption(
          [{ ...update, minimumReleaseAge: null, releaseTimestamp: undefined }],
          'poetry',
          'pypi',
          0,
        ),
      ).toBe(null);
    });
  });

  describe('.isReleaseOldEnough()', () => {
    const releaseTimestamp = '2021-01-01T00:00:00.000Z' as Timestamp;

    it.each`
      timestamp           | elapsed     | age         | expected
      ${undefined}        | ${'0 days'} | ${'0 days'} | ${true}
      ${undefined}        | ${'0 days'} | ${'1 day'}  | ${false}
      ${releaseTimestamp} | ${'2 days'} | ${'1 day'}  | ${true}
      ${releaseTimestamp} | ${'1 day'}  | ${'1 day'}  | ${true}
      ${releaseTimestamp} | ${'1 day'}  | ${'2 days'} | ${false}
    `(
      'returns $expected for a release of $timestamp, $elapsed old, and an age of $age',
      ({ timestamp, elapsed, age, expected }) => {
        dateUtil.getElapsedMs.mockReturnValue(toMs(elapsed) ?? 0);

        expect(
          isReleaseOldEnough({ releaseTimestamp: timestamp }, toMs(age) ?? 0),
        ).toBe(expected);
      },
    );
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
