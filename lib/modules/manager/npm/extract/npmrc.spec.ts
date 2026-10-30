import { calculateMinimumReleaseAgeMs } from '../../../../util/minimum-release-age.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { PackageFile } from '../../types.ts';
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
  });

  describe('getNpmrcMinimumReleaseAge()', () => {
    it.each`
      content                                | expected
      ${null}                                | ${undefined}
      ${'min-release-age=bananas\n'}         | ${undefined}
      ${'before=bananas\n'}                  | ${undefined}
      ${'min-release-age=3\n'}               | ${'3 days'}
      ${'min-release-age=0\n'}               | ${'0 days'}
      ${'before=2026-06-12T12:00:00.000Z\n'} | ${'259200000 milliseconds'}
      ${'before=2026-06-15T12:00:00.000Z\n'} | ${undefined}
      ${'before=2026-06-20T00:00:00.000Z\n'} | ${undefined}
    `('returns $expected for $content', ({ content, expected }) => {
      expect(getNpmrcMinimumReleaseAge(content)).toBe(expected);
    });

    it.each`
      content                                | minimumReleaseAge | expected
      ${'min-release-age=3\n'}               | ${'1 day'}        | ${'3 days'}
      ${'min-release-age=3\n'}               | ${'5 days'}       | ${'5 days'}
      ${'min-release-age=3\n'}               | ${null}           | ${'3 days'}
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
  });

  describe('setNpmrcMinimumReleaseAge()', () => {
    function packageFile(
      managerData: NpmManagerData,
    ): Partial<PackageFile<NpmManagerData>> {
      return { packageFile: 'package.json', managerData };
    }

    const repoNpmrc = {
      fileName: '.npmrc',
      content: 'min-release-age=3\n',
      detectedLineEnding: '\n',
    } as const;

    it('sets minimumReleaseAgeExtracted from the repository .npmrc', () => {
      const packageFiles = [
        packageFile({ npmLock: 'package-lock.json', repoNpmrc }),
        packageFile({ repoNpmrc }),
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      expect(packageFiles).toMatchObject([
        { minimumReleaseAgeExtracted: '3 days' },
        { minimumReleaseAgeExtracted: '3 days' },
      ]);
    });

    it('skips package files without a minimum release age in the repository .npmrc', () => {
      const packageFiles = [
        packageFile({ npmLock: 'package-lock.json' }),
        packageFile({
          npmLock: 'package-lock.json',
          repoNpmrc: { ...repoNpmrc, content: 'audit=false\n' },
        }),
        {},
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      for (const file of packageFiles) {
        expect(file.minimumReleaseAgeExtracted).toBeUndefined();
      }
    });

    it('skips package files managed by Yarn or pnpm', () => {
      const packageFiles = [
        packageFile({ yarnLock: 'yarn.lock', repoNpmrc }),
        packageFile({ pnpmLockFile: 'pnpm-lock.yaml', repoNpmrc }),
      ];

      setNpmrcMinimumReleaseAge(packageFiles);

      for (const file of packageFiles) {
        expect(file.minimumReleaseAgeExtracted).toBeUndefined();
      }
    });
  });
});
