import minimatch from 'minimatch';
import { regEx } from '../../../util/regex';
import { defaultConfig } from './default-config';

describe('modules/manager/hermit/default-config', () => {
  describe('excludeCommitPaths', () => {
    function miniMatches(target: string, patterns: string[]): boolean {
      return patterns.some((patt: string) => {
        return minimatch(target, patt, { dot: true });
      });
    }

    test.each`
      path                          | expected
      ${'bin/hermit'}               | ${true}
      ${'gradle/bin/hermit'}        | ${true}
      ${'nested/module/bin/hermit'} | ${true}
      ${'nested/testbin/hermit'}    | ${false}
      ${'other'}                    | ${false}
      ${'nested/other'}             | ${false}
      ${'nested/module/other'}      | ${false}
    `('minimatches("$path") === $expected', ({ path, expected }) => {
      expect(miniMatches(path, defaultConfig.excludeCommitPaths)).toBe(
        expected
      );
    });
  });

  describe('fileMatch', () => {
    function regexMatches(target: string, patterns: string[]): boolean {
      return patterns.some((patt: string) => {
        const re = regEx(patt);
        return re.test(target);
      });
    }

    test.each`
      path                          | expected
      ${'bin/hermit'}               | ${true}
      ${'gradle/bin/hermit'}        | ${true}
      ${'nested/module/bin/hermit'} | ${true}
      ${'nested/testbin/hermit'}    | ${false}
      ${'other'}                    | ${false}
      ${'nested/other'}             | ${false}
      ${'nested/module/other'}      | ${false}
    `('regexMatches("$path") === $expected', ({ path, expected }) => {
      expect(regexMatches(path, defaultConfig.fileMatch)).toBe(expected);
    });
  });
});
