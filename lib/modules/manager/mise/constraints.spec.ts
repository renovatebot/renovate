import { getToolConfig } from '../../../util/exec/containerbase.ts';
import type { ToolName } from '../../../util/exec/types.ts';
import {
  getConstraintName,
  getConstraintValue,
  getSharedConstraintsScope,
} from './constraints.ts';

describe('modules/manager/mise/constraints', () => {
  describe('getConstraintName()', () => {
    it.each`
      depName                         | expected
      ${'node'}                       | ${'node'}
      ${'nodejs'}                     | ${'node'}
      ${'core:node'}                  | ${'node'}
      ${'asdf:python'}                | ${'python'}
      ${'vfox:pnpm'}                  | ${'pnpm'}
      ${'go'}                         | ${'golang'}
      ${'flux2'}                      | ${'flux'}
      ${'npm:pnpm'}                   | ${'pnpm'}
      ${'npm:@yarnpkg/cli-dist'}      | ${'yarn'}
      ${'aqua:astral-sh/uv'}          | ${'uv'}
      ${'pypi:poetry'}                | ${'poetry'}
      ${'gem:bundler'}                | ${'bundler'}
      ${'asdf:mise-plugins/mise-php'} | ${undefined}
      ${'asdf:mise-plugins/asdf-php'} | ${'php'}
      ${'npm:prettier'}               | ${undefined}
      ${'cargo:pnpm'}                 | ${undefined}
      ${'terraform'}                  | ${undefined}
      ${'constructor'}                | ${undefined}
    `('maps $depName to $expected', ({ depName, expected }) => {
      expect(getConstraintName(depName)).toBe(expected);
    });

    it('only maps to tools Renovate can install', () => {
      const names = [
        'bazelisk',
        'bun',
        'bundler',
        'cocoapods',
        'conan',
        'copier',
        'dart',
        'deno',
        'dotnet',
        'elixir',
        'erlang',
        'flutter',
        'flux2',
        'gh',
        'gleam',
        'go',
        'gradle',
        'helm',
        'helmfile',
        'java',
        'jb',
        'kustomize',
        'maven',
        'node',
        'npm',
        'pdm',
        'php',
        'pipenv',
        'pixi',
        'pnpm',
        'poetry',
        'python',
        'ruby',
        'rust',
        'uv',
        'vendir',
        'yarn',
      ];

      const toolNames = names.map((name) => getConstraintName(name)!);

      expect(toolNames.filter((name) => !getToolConfig(name))).toEqual([]);
    });
  });

  describe('getConstraintValue()', () => {
    it.each`
      constraintName | version         | expected
      ${'node'}      | ${'20'}         | ${'20'}
      ${'node'}      | ${'20.11.0'}    | ${'20.11.0'}
      ${'node'}      | ${'v20.11.0'}   | ${'20.11.0'}
      ${'pnpm'}      | ${'10.16'}      | ${'10.16'}
      ${'rust'}      | ${'1.100'}      | ${'1.100'}
      ${'java'}      | ${'21.0.2+13'}  | ${'21.0.2+13'}
      ${'python'}    | ${'3.12.4'}     | ${'3.12.4'}
      ${'python'}    | ${'3.12'}       | ${null}
      ${'ruby'}      | ${'3.3'}        | ${null}
      ${'helm'}      | ${'3'}          | ${null}
      ${'node'}      | ${'latest'}     | ${null}
      ${'node'}      | ${'lts'}        | ${null}
      ${'node'}      | ${'ref:main'}   | ${null}
      ${'node'}      | ${'path:./x'}   | ${null}
      ${'node'}      | ${'prefix:20'}  | ${null}
      ${'node'}      | ${'sub-1:lts'}  | ${null}
      ${'java'}      | ${'temurin-21'} | ${null}
      ${'node'}      | ${null}         | ${null}
    `(
      'returns $expected for $constraintName $version',
      ({ constraintName, version, expected }) => {
        expect(getConstraintValue(constraintName as ToolName, version)).toBe(
          expected,
        );
      },
    );
  });

  describe('getSharedConstraintsScope()', () => {
    it.each`
      packageFile                                    | directory     | precedence
      ${'mise.toml'}                                 | ${''}         | ${7}
      ${'.mise.toml'}                                | ${''}         | ${8}
      ${'mise.local.toml'}                           | ${''}         | ${16}
      ${'.mise.local.toml'}                          | ${''}         | ${17}
      ${'mise/config.toml'}                          | ${''}         | ${6}
      ${'.mise/config.toml'}                         | ${''}         | ${5}
      ${'.config/mise.toml'}                         | ${''}         | ${4}
      ${'.config/mise/mise.toml'}                    | ${''}         | ${3}
      ${'.config/mise/config.toml'}                  | ${''}         | ${2}
      ${'.config/mise/config.local.toml'}            | ${''}         | ${11}
      ${'.config/mise/conf.d/node.toml'}             | ${''}         | ${1}
      ${'.rtx.toml'}                                 | ${''}         | ${0}
      ${'apps/web/mise.toml'}                        | ${'apps/web'} | ${7}
      ${'apps/web/.config/mise/config.toml'}         | ${'apps/web'} | ${2}
      ${'apps/mise/config.toml'}                     | ${'apps'}     | ${6}
      ${'apps/.config/mise/conf.d/tools.local.toml'} | ${'apps'}     | ${10}
    `(
      'returns $directory for $packageFile',
      ({ packageFile, directory, precedence }) => {
        expect(getSharedConstraintsScope(packageFile)).toEqual({
          directory,
          precedence,
        });
      },
    );

    it.each`
      packageFile
      ${'mise.production.toml'}
      ${'mise.production.local.toml'}
      ${'.config/mise/config.test.toml'}
      ${'apps/mise.ci.toml'}
      ${'apps/other.toml'}
    `('returns null for $packageFile', ({ packageFile }) => {
      expect(getSharedConstraintsScope(packageFile)).toBeNull();
    });
  });
});
