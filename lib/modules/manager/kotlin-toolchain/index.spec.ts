import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/kotlin-toolchain/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path                               | expected
      ${'module.yaml'}                   | ${true}
      ${'sub/module.yaml'}               | ${true}
      ${'project.yaml'}                  | ${true}
      ${'sub/project.yaml'}              | ${true}
      ${'common.module-template.yaml'}   | ${true}
      ${'a/common.module-template.yaml'} | ${true}
      ${'libs.versions.toml'}            | ${true}
      ${'gradle/libs.versions.toml'}     | ${true}
      ${'app/libs.versions.toml'}        | ${true}
      ${'app/gradle/libs.versions.toml'} | ${true}
      ${'tools.versions.toml'}           | ${false}
      ${'libs.versions.toml.bak'}        | ${false}
      ${'modules.yaml'}                  | ${false}
      ${'module.yml'}                    | ${false}
      ${'projects.yaml'}                 | ${false}
      ${'module-template.yaml'}          | ${false}
      ${'module.yaml.bak'}               | ${false}
      ${'mymodule.yaml'}                 | ${false}
    `('matchRegexOrGlobList("$path") === $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });
});
