import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/tox/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path                            | expected
      ${'tox.toml'}                   | ${true}
      ${'pyproject.toml'}             | ${true}
      ${'subdir/tox.toml'}            | ${true}
      ${'subdir/pyproject.toml'}      | ${true}
      ${'deep/nested/tox.toml'}       | ${true}
      ${'deep/nested/pyproject.toml'} | ${true}
      ${'tox.toml.bak'}               | ${false}
      ${'not-tox.toml'}               | ${false}
      ${'tox.yaml'}                   | ${false}
      ${'setup.cfg'}                  | ${false}
    `('matchRegexOrGlobList("$path") === $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });
});
