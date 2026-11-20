import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/kotlin-toolchain-wrapper/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path                         | expected
      ${'kotlin'}                  | ${true}
      ${'kotlin.bat'}              | ${true}
      ${'sub/kotlin'}              | ${true}
      ${'sub/kotlin.bat'}          | ${true}
      ${'deep/nested/kotlin'}      | ${true}
      ${'kotlin-from-sources'}     | ${false}
      ${'kotlin-from-sources.bat'} | ${false}
      ${'kotlinc'}                 | ${false}
      ${'kotlin.sh'}               | ${false}
      ${'sub/kotlin.cmd'}          | ${false}
      ${'mykotlin'}                | ${false}
    `('matchRegexOrGlobList("$path") === $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });
});
