import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/mise/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path                                     | expected
      ${'mise.toml'}                           | ${true}
      ${'.mise.toml'}                          | ${true}
      ${'mise.local.toml'}                     | ${true}
      ${'.mise.local.toml'}                    | ${true}
      ${'mise.production.toml'}                | ${true}
      ${'.mise.dev.toml'}                      | ${true}
      ${'mise/config.toml'}                    | ${true}
      ${'.mise/config.toml'}                   | ${true}
      ${'mise/config.local.toml'}              | ${true}
      ${'.mise/config.production.toml'}        | ${true}
      ${'.config/mise.toml'}                   | ${true}
      ${'.config/mise.local.toml'}             | ${true}
      ${'.config/mise.staging.toml'}           | ${true}
      ${'.config/mise/config.toml'}            | ${true}
      ${'.config/mise/config.local.toml'}      | ${true}
      ${'.config/mise/config.production.toml'} | ${true}
      ${'.config/mise/mise.toml'}              | ${true}
      ${'.config/mise/mise.local.toml'}        | ${true}
      ${'.config/mise/mise.dev.toml'}          | ${true}
      ${'.rtx.toml'}                           | ${true}
      ${'.rtx.local.toml'}                     | ${true}
      ${'.rtx.production.toml'}                | ${true}
      ${'subdir/mise.toml'}                    | ${true}
      ${'subdir/.mise.toml'}                   | ${true}
      ${'subdir/.config/mise.toml'}            | ${true}
      ${'subdir/.config/mise/config.toml'}     | ${true}
      ${'deep/nested/path/mise.toml'}          | ${true}
      ${'deep/nested/.config/mise/mise.toml'}  | ${true}
      ${'foo.toml'}                            | ${false}
      ${'mise.json'}                           | ${false}
      ${'mise.yaml'}                           | ${false}
      ${'mise-config.toml'}                    | ${false}
      ${'rtx.toml'}                            | ${false}
      ${'.config/other.toml'}                  | ${false}
      ${'mise.toml.backup'}                    | ${false}
      ${'.mise.toml.bak'}                      | ${false}
    `('matchRegexOrGlobList("$path") === $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });
});
