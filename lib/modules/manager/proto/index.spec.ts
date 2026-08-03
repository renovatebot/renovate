import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/proto/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path                              | expected
      ${'.prototools'}                  | ${true}
      ${'subdir/.prototools'}           | ${true}
      ${'deep/nested/path/.prototools'} | ${true}
      ${'prototools'}                   | ${false}
      ${'.prototools.bak'}              | ${false}
      ${'.prototools.toml'}             | ${false}
      ${'prototools.toml'}              | ${false}
    `('matchRegexOrGlobList("$path") === $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });
});
