import { calculateMinimumReleaseAgeMs } from '../../../../util/minimum-release-age.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { NpmrcPackageFile } from '../../types.ts';
import { applyConfigNpmrc } from '../npmrc.ts';
import type { NpmManagerData } from '../types.ts';
import {
  getNpmrcMinimumReleaseAge,
  parseNpmrcCooldown,
  setNpmrcMinimumReleaseAge,
} from './npmrc.ts';

describe('modules/manager/npm/extract/npmrc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseNpmrcCooldown()', () => {
    it.each`
      content
      ${null}
      ${undefined}
      ${''}
      ${'registry=https://registry.npmjs.org\n'}
      ${'before=not-a-date\n'}
      ${'before=2026-13-99T00:00:00.000Z\n'}
      ${'min-release-age=not-a-number\n'}
      ${'min-release-age=-1\n'}
      ${'min-release-age=7d\n'}
      ${'min-release-age=Infinity\n'}
    `('returns null for: $content', ({ content }) => {
      expect(parseNpmrcCooldown(content)).toBeNull();
    });

    it.each`
      input
      ${'before=2026-06-01T00:00:00.000Z\n'}
      ${'before="2026-06-01T00:00:00.000Z"\n'}
      ${'registry=https://registry.npmjs.org\nbefore=2026-06-01T00:00:00.000Z # some comment\naudit=false\n'}
      ${'before=2026-06-01T00:00:00.000Z\nmin-release-age=30\n'}
    `('parses before from $input', ({ input }) => {
      const result = parseNpmrcCooldown(input);

      expect(result?.source).toBe('before');
      expect(result?.source === 'before' && result.date.toISO()).toBe(
        '2026-06-01T00:00:00.000Z',
      );
    });

    it.each`
      input
      ${'min-release-age=30\n'}
      ${'min-release-age="30"\n'}
      ${'min-release-age=30 # 30 days\n'}
      ${'registry=https://registry.npmjs.org\nmin-release-age=30 # 30 days\n'}
      ${'before=not-a-date\nmin-release-age=30\n'}
    `('parses min-release-age from $input', ({ input }) => {
      expect(parseNpmrcCooldown(input)).toEqual({
        source: 'min-release-age',
        days: 30,
      });
    });

    it.each`
      input                      | days
      ${'min-release-age=0\n'}   | ${0}
      ${'min-release-age=1.5\n'} | ${1.5}
    `('parses min-release-age $days from $input', ({ input, days }) => {
      expect(parseNpmrcCooldown(input)).toEqual({
        source: 'min-release-age',
        days,
      });
    });
  });

  describe('getNpmrcMinimumReleaseAge()', () => {
    it.each`
      content                                | expected
      ${null}                                | ${undefined}
      ${'min-release-age=bananas\n'}         | ${undefined}
      ${'min-release-age=7d\n'}              | ${undefined}
      ${'before=bananas\n'}                  | ${undefined}
      ${'min-release-age=3\n'}               | ${'3 days'}
      ${'min-release-age=0\n'}               | ${'0 days'}
      ${'min-release-age=1.5\n'}             | ${'1.5 days'}
      ${'before=2026-06-12T12:00:00.000Z\n'} | ${'2026-06-12T12:00:00.000Z'}
      ${'before=2026-06-20T00:00:00.000Z\n'} | ${'2026-06-20T00:00:00.000Z'}
    `('returns $expected for $content', ({ content, expected }) => {
      expect(getNpmrcMinimumReleaseAge(content)).toBe(expected);
    });

    it.each`
      content                                | minimumReleaseAge | expected
      ${'min-release-age=3\n'}               | ${'1 day'}        | ${'3 days'}
      ${'min-release-age=3\n'}               | ${'5 days'}       | ${'5 days'}
      ${'min-release-age=3\n'}               | ${null}           | ${'3 days'}
      ${'min-release-age=1.5\n'}             | ${'1 day'}        | ${'36 hours'}
      ${'min-release-age=7d\n'}              | ${'1 day'}        | ${'1 day'}
      ${'before=2026-06-12T12:00:00.000Z\n'} | ${'1 day'}        | ${'3 days'}
      ${'before=2026-06-12T12:00:00.000Z\n'} | ${'5 days'}       | ${'5 days'}
    `(
      'uses the larger of $content and minimumReleaseAge=$minimumReleaseAge',
      ({ content, minimumReleaseAge, expected }) => {
        expect(
          calculateMinimumReleaseAgeMs({
            minimumReleaseAge,
            minimumReleaseAgeExtracted: getNpmrcMinimumReleaseAge(content),
          }),
        ).toBe(toMs(expected));
      },
    );

    it('counts a before date as the time elapsed since that date when the age is used', () => {
      const minimumReleaseAgeExtracted = getNpmrcMinimumReleaseAge(
        'before=2026-06-12T12:00:00.000Z\n',
      );

      vi.setSystemTime(new Date('2026-06-22T12:00:00.000Z'));

      expect(calculateMinimumReleaseAgeMs({ minimumReleaseAgeExtracted })).toBe(
        toMs('10 days'),
      );
    });
  });

  describe('setNpmrcMinimumReleaseAge()', () => {
    function packageFile(
      managerData: NpmManagerData,
      npmrc?: string,
    ): Partial<NpmrcPackageFile<NpmManagerData>> {
      return { packageFile: 'package.json', managerData, npmrc };
    }

    const npmrc = 'min-release-age=3\n';

    it('adds a packageRules entry from the repository .npmrc', () => {
      const packageFiles = [
        packageFile({ npmLock: 'package-lock.json' }, npmrc),
        packageFile({}, npmrc),
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      const packageRules = [
        { matchDatasources: ['npm'], minimumReleaseAgeExtracted: '3 days' },
      ];
      expect(packageFiles).toMatchObject([{ packageRules }, { packageRules }]);
    });

    it('uses the merged npmrc, which includes the npmrc option', () => {
      const merged = applyConfigNpmrc(
        { npmrc: 'min-release-age=5\n' },
        undefined,
      );
      const packageFiles = [packageFile({ npmrcFileName: null }, merged)];

      setNpmrcMinimumReleaseAge(packageFiles);

      expect(packageFiles[0].packageRules).toEqual([
        { matchDatasources: ['npm'], minimumReleaseAgeExtracted: '5 days' },
      ]);
    });

    it('ignores the repository .npmrc when it is not merged into the npmrc option', () => {
      const merged = applyConfigNpmrc(
        { npmrc: 'audit=false\n', npmrcMerge: false },
        {
          fileName: '.npmrc',
          content: 'min-release-age=3\n',
          detectedLineEnding: '\n',
        },
      );
      const packageFiles = [packageFile({ npmrcFileName: '.npmrc' }, merged)];

      setNpmrcMinimumReleaseAge(packageFiles);

      expect(merged).toBe('audit=false\n');
      expect(packageFiles[0].packageRules).toBeUndefined();
    });

    it('keeps existing packageRules', () => {
      const existing = {
        matchPackageNames: ['foo'],
        minimumReleaseAgeExtracted: null,
      };
      const packageFiles = [
        {
          ...packageFile({}, 'before=2026-06-12T12:00:00.000Z\n'),
          packageRules: [existing],
        },
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      expect(packageFiles[0].packageRules).toEqual([
        existing,
        {
          matchDatasources: ['npm'],
          minimumReleaseAgeExtracted: '2026-06-12T12:00:00.000Z',
        },
      ]);
    });

    it('skips package files without a minimum release age in the repository .npmrc', () => {
      const packageFiles = [
        packageFile({ npmLock: 'package-lock.json' }),
        packageFile({ npmLock: 'package-lock.json' }, 'audit=false\n'),
        {},
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      for (const file of packageFiles) {
        expect(file.packageRules).toBeUndefined();
      }
    });

    it('skips package files managed by Yarn or pnpm', () => {
      const packageFiles = [
        packageFile({ yarnLock: 'yarn.lock' }, npmrc),
        packageFile({ pnpmLockFile: 'pnpm-lock.yaml' }, npmrc),
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      for (const file of packageFiles) {
        expect(file.packageRules).toBeUndefined();
      }
    });
  });
});
