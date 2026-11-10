import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { calculateMinimumReleaseAgeMs } from '../../../../util/minimum-release-age.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import { matchRegexOrGlobList } from '../../../../util/string-match.ts';
import type { NpmrcPackageFile } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import {
  getPnpmMinimumReleaseAgeMinutes,
  isPnpmMinimumReleaseAgeExcluded,
  parsePnpmMinimumReleaseAgeExclude,
  readPnpmWorkspaceMinimumReleaseAge,
  setPnpmMinimumReleaseAge,
  toMatchPackageNamesPattern,
} from './pnpm-minimum-release-age.ts';

vi.mock('../../../../util/fs/index.ts');

function mockWorkspace(
  content: string | null,
  lockFileContent: string | null = null,
): void {
  const files: Record<string, string | null> = {
    'some-dir/pnpm-workspace.yaml': content,
    'some-dir/pnpm-lock.yaml': lockFileContent,
  };
  fs.readLocalFile.mockImplementation((fileName: string) =>
    Promise.resolve(files[fileName] ?? null),
  );
}

describe('modules/manager/npm/extract/pnpm-minimum-release-age', () => {
  describe('readPnpmWorkspaceMinimumReleaseAge()', () => {
    it.each`
      content                                                       | expected
      ${null}                                                       | ${{}}
      ${'packages:\n  - pkgs/*\n'}                                  | ${{}}
      ${'- not a mapping\n'}                                        | ${{}}
      ${'minimumReleaseAge: 1440\n'}                                | ${{ minimumReleaseAge: 1440 }}
      ${'minimumReleaseAge: -1\n'}                                  | ${{}}
      ${'minimumReleaseAge: bananas\nminimumReleaseAgeStrict: 1\n'} | ${{}}
      ${'minimumReleaseAge: 60\nminimumReleaseAgeStrict: false\n'}  | ${{ minimumReleaseAge: 60, minimumReleaseAgeStrict: false }}
      ${'minimumReleaseAgeExclude:\n  - foo\n'}                     | ${{ minimumReleaseAgeExclude: ['foo'] }}
      ${'minimumReleaseAgeExclude: foo\n'}                          | ${{ minimumReleaseAgeExclude: ['foo'] }}
      ${'minimumReleaseAgeExclude: 1\n'}                            | ${{}}
    `('returns $expected for $content', async ({ content, expected }) => {
      mockWorkspace(content);

      await expect(
        readPnpmWorkspaceMinimumReleaseAge('some-dir/pnpm-lock.yaml'),
      ).resolves.toEqual(expected);
    });
  });

  describe('setPnpmMinimumReleaseAge()', () => {
    function packageFile(
      packageFile: string,
      managerData?: NpmManagerData,
    ): Partial<NpmrcPackageFile<NpmManagerData>> {
      return { packageFile, managerData };
    }

    const npmrc = 'minimum-release-age=2880\n';

    function rule(minimumReleaseAgeExtracted: string) {
      return { matchDatasources: ['npm'], minimumReleaseAgeExtracted };
    }

    it('adds packageRules to the package files of each pnpm lock file', async () => {
      mockWorkspace('minimumReleaseAge: 1440\n');
      const existing = {
        matchPackageNames: ['foo'],
        minimumReleaseAgeExtracted: null,
      };
      const packageFiles = [
        packageFile('some-dir/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        {
          ...packageFile('some-dir/pkgs/a/package.json', {
            pnpmLockFile: 'some-dir/pnpm-lock.yaml',
          }),
          packageRules: [existing],
        },
        packageFile('some-dir/pnpm-workspace.yaml', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        packageFile('other/package.json', {
          npmLock: 'other/package-lock.json',
        }),
        packageFile('none/package.json'),
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      expect(packageFiles.map((p) => p.packageRules)).toEqual([
        [rule('1440 minutes')],
        [existing, rule('1440 minutes')],
        [rule('1440 minutes')],
        undefined,
        undefined,
      ]);
      // the workspace and lock file are read once per lock file
      expect(fs.readLocalFile).toHaveBeenCalledTimes(2);
    });

    it.each`
      workspace                                                 | expected
      ${'minimumReleaseAge: 60\n'}                              | ${{ minimumReleaseAge: 60 }}
      ${'minimumReleaseAge: 0\nminimumReleaseAgeStrict: false'} | ${{ minimumReleaseAge: 0, minimumReleaseAgeStrict: false }}
      ${'minimumReleaseAgeStrict: false\n'}                     | ${{ minimumReleaseAgeStrict: false }}
      ${'minimumReleaseAgeExclude:\n  - foo\n'}                 | ${{ hasMinimumReleaseAgeExclude: true }}
      ${'minimumReleaseAgeExclude: []\n'}                       | ${{}}
      ${'packages: []\n'}                                       | ${{}}
    `(
      'keeps the pnpm-workspace.yaml settings $workspace in managerData',
      async ({ workspace, expected }) => {
        mockWorkspace(workspace);
        const packageFiles = [
          packageFile('some-dir/package.json', {
            pnpmLockFile: 'some-dir/pnpm-lock.yaml',
          }),
          packageFile('some-dir/pnpm-workspace.yaml', {
            pnpmLockFile: 'some-dir/pnpm-lock.yaml',
          }),
        ];

        await setPnpmMinimumReleaseAge(packageFiles, {});

        expect(
          packageFiles.map((p) => p.managerData?.pnpmMinimumReleaseAge),
        ).toEqual([expected, expected]);
      },
    );

    it('uses the larger of the pnpm-workspace.yaml value and minimumReleaseAge', async () => {
      mockWorkspace('minimumReleaseAge: 1440\n');
      const packageFiles = [
        packageFile('some-dir/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      const { minimumReleaseAgeExtracted } = packageFiles[0].packageRules![0];
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '7 days',
          minimumReleaseAgeExtracted,
        }),
      ).toBe(toMs('7 days'));
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '1 hour',
          minimumReleaseAgeExtracted,
        }),
      ).toBe(toMs('1 day'));
    });

    it('excludes the packages of minimumReleaseAgeExclude', async () => {
      mockWorkspace(codeBlock`
        minimumReleaseAge: 60
        minimumReleaseAgeExclude:
          - foo
          - '@scope/*'
          - bar@1.0.0
      `);
      const packageFiles = [
        packageFile('some-dir/pnpm-workspace.yaml', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      expect(packageFiles[0].packageRules).toEqual([
        rule('60 minutes'),
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['foo'],
          minimumReleaseAgeExtracted: null,
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['/^@scope/.*$/'],
          minimumReleaseAgeExtracted: null,
        },
      ]);
    });

    it.each`
      pnpm          | content
      ${'^10.20.0'} | ${null}
      ${'^11.0.0'}  | ${'minimumReleaseAge: 0\n'}
    `(
      'skips package files without a minimum release age for pnpm $pnpm: $content',
      async ({ pnpm, content }) => {
        mockWorkspace(content);
        const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
          {
            ...packageFile('some-dir/package.json', {
              pnpmLockFile: 'some-dir/pnpm-lock.yaml',
            }),
            extractedConstraints: { pnpm },
          },
        ];

        await setPnpmMinimumReleaseAge(packageFiles, {});

        expect(packageFiles[0].packageRules).toBeUndefined();
      },
    );

    it.each`
      pnpm          | expected
      ${'^11.0.0'}  | ${[rule('1440 minutes')]}
      ${'>=9'}      | ${[rule('1440 minutes')]}
      ${undefined}  | ${[rule('1440 minutes')]}
      ${'latest'}   | ${[rule('1440 minutes')]}
      ${'^10.20.0'} | ${undefined}
    `(
      'adds the pnpm v11 default without a setting for pnpm $pnpm',
      async ({ pnpm, expected }) => {
        mockWorkspace('packages:\n  - pkgs/*\n');
        const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
          {
            ...packageFile('some-dir/package.json', {
              pnpmLockFile: 'some-dir/pnpm-lock.yaml',
            }),
            extractedConstraints: { pnpm },
          },
        ];

        await setPnpmMinimumReleaseAge(packageFiles, {});

        expect(packageFiles[0].packageRules).toEqual(expected);
      },
    );

    it.each`
      pnpm          | workspace                    | expected
      ${'^10.20.0'} | ${null}                      | ${'2880 minutes'}
      ${'^10.20.0'} | ${'minimumReleaseAge: 60\n'} | ${'60 minutes'}
      ${'^11.0.0'}  | ${null}                      | ${'1440 minutes'}
      ${undefined}  | ${null}                      | ${'1440 minutes'}
    `(
      'reads the .npmrc for pnpm $pnpm and workspace=$workspace',
      async ({ pnpm, workspace, expected }) => {
        mockWorkspace(workspace);
        const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
          packageFile('some-dir/pnpm-workspace.yaml', {
            pnpmLockFile: 'some-dir/pnpm-lock.yaml',
          }),
          {
            packageFile: 'some-dir/package.json',
            extractedConstraints: { pnpm },
            npmrc,
            managerData: { pnpmLockFile: 'some-dir/pnpm-lock.yaml' },
          },
        ];

        await setPnpmMinimumReleaseAge(packageFiles, {});

        // the pnpm-workspace.yaml gets the value of the root package.json
        for (const file of packageFiles) {
          expect(file.packageRules?.[0].minimumReleaseAgeExtracted).toBe(
            expected,
          );
        }
      },
    );

    it('keeps the pnpm constraint and .npmrc of the root package.json for every package file of the lock file', async () => {
      mockWorkspace(null);
      const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
        packageFile('some-dir/pnpm-workspace.yaml', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        packageFile('some-dir/pkgs/a/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        {
          packageFile: 'some-dir/package.json',
          extractedConstraints: { pnpm: '10.17.0' },
          npmrc,
          managerData: { pnpmLockFile: 'some-dir/pnpm-lock.yaml' },
        },
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      for (const file of packageFiles) {
        expect(file.managerData?.pnpmMinimumReleaseAge).toEqual({
          pnpmConstraint: '10.17.0',
          npmrcMinimumReleaseAge: 2880,
        });
      }
    });

    it('reads the .npmrc of another package file without a root package.json', async () => {
      mockWorkspace(null);
      const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
        packageFile('some-dir/pnpm-workspace.yaml', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        {
          packageFile: 'some-dir/pkgs/a/package.json',
          extractedConstraints: { pnpm: '^10.20.0' },
          npmrc,
          managerData: { pnpmLockFile: 'some-dir/pnpm-lock.yaml' },
        },
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      expect(packageFiles.map((p) => p.packageRules)).toEqual([
        [rule('2880 minutes')],
        [rule('2880 minutes')],
      ]);
    });

    it('reads the minimum release age of the npmrc option without a repository .npmrc', async () => {
      mockWorkspace(null);
      const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
        {
          packageFile: 'some-dir/package.json',
          extractedConstraints: { pnpm: '^10.20.0' },
          // the merged .npmrc, which has only the `npmrc` option
          npmrc: 'minimum-release-age=60\n',
          managerData: { pnpmLockFile: 'some-dir/pnpm-lock.yaml' },
        },
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      expect(packageFiles[0].packageRules).toEqual([rule('60 minutes')]);
    });

    it.each`
      constraints            | extracted     | lockfileVersion | expected
      ${{ pnpm: '10.20.0' }} | ${'^11.0.0'}  | ${"'9.0'"}      | ${'2880 minutes'}
      ${{ pnpm: '11.0.0' }}  | ${'^10.20.0'} | ${"'6.0'"}      | ${'1440 minutes'}
      ${{}}                  | ${undefined}  | ${"'6.0'"}      | ${'2880 minutes'}
      ${{}}                  | ${undefined}  | ${5.4}          | ${'2880 minutes'}
      ${{}}                  | ${'^11.0.0'}  | ${"'6.0'"}      | ${'1440 minutes'}
      ${{}}                  | ${undefined}  | ${"'9.0'"}      | ${'1440 minutes'}
      ${{}}                  | ${undefined}  | ${undefined}    | ${'1440 minutes'}
    `(
      'resolves pnpm for constraints=$constraints, extracted=$extracted and lockfileVersion=$lockfileVersion like the lock file update',
      async ({ constraints, extracted, lockfileVersion, expected }) => {
        mockWorkspace(
          null,
          lockfileVersion === undefined
            ? null
            : `lockfileVersion: ${lockfileVersion}\n`,
        );
        const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
          {
            packageFile: 'some-dir/package.json',
            extractedConstraints: { pnpm: extracted },
            npmrc,
            managerData: { pnpmLockFile: 'some-dir/pnpm-lock.yaml' },
          },
        ];

        await setPnpmMinimumReleaseAge(packageFiles, { constraints });

        expect(packageFiles[0].packageRules).toEqual([rule(expected)]);
      },
    );

    it('adds no pnpm v11 default for a v6 lock file without a pnpm version', async () => {
      mockWorkspace(null, "lockfileVersion: '6.0'\n");
      const packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[] = [
        packageFile('some-dir/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
      ];

      await setPnpmMinimumReleaseAge(packageFiles, {});

      expect(packageFiles[0].packageRules).toBeUndefined();
    });
  });

  describe('toMatchPackageNamesPattern()', () => {
    // pnpm: `*` matches any characters including `/`, `?` one character, and
    // `!` negates the rest of the pattern
    it.each`
      pnpm            | renovate
      ${'foo'}        | ${'foo'}
      ${'@scope/foo'} | ${'@scope/foo'}
      ${'lodash.get'} | ${'lodash.get'}
      ${'*'}          | ${'*'}
      ${'@scope/*'}   | ${'/^@scope/.*$/'}
      ${'*-plugin'}   | ${'/^.*-plugin$/'}
      ${'@*/core'}    | ${'/^@.*/core$/'}
      ${'foo?'}       | ${'/^foo.$/'}
      ${'foo.*'}      | ${'/^foo\\..*$/'}
      ${'(foo)+'}     | ${'/^\\(foo\\)\\+$/'}
      ${'!foo'}       | ${'!foo'}
      ${'!@scope/*'}  | ${'!/^@scope/.*$/'}
      ${'!*'}         | ${null}
    `('translates $pnpm to $renovate', ({ pnpm, renovate }) => {
      expect(toMatchPackageNamesPattern(pnpm)).toBe(renovate);
    });

    it.each`
      pnpm           | packageName          | matches
      ${'foo'}       | ${'foo'}             | ${true}
      ${'foo'}       | ${'foo-bar'}         | ${false}
      ${'*'}         | ${'@scope/foo'}      | ${true}
      ${'@scope/*'}  | ${'@scope/foo'}      | ${true}
      ${'@scope/*'}  | ${'@scope/foo/bar'}  | ${true}
      ${'@scope/*'}  | ${'@other/foo'}      | ${false}
      ${'*-plugin'}  | ${'@scope/a-plugin'} | ${true}
      ${'*-plugin'}  | ${'a-plugins'}       | ${false}
      ${'@*/core'}   | ${'@babel/core'}     | ${true}
      ${'foo?'}      | ${'foo1'}            | ${true}
      ${'foo?'}      | ${'foo12'}           | ${false}
      ${'foo.*'}     | ${'foo.bar'}         | ${true}
      ${'foo.*'}     | ${'foo-bar'}         | ${false}
      ${'(foo)+'}    | ${'(foo)+'}          | ${true}
      ${'(foo)+'}    | ${'foofoo'}          | ${false}
      ${'!foo'}      | ${'foo'}             | ${false}
      ${'!foo'}      | ${'bar'}             | ${true}
      ${'!@scope/*'} | ${'@scope/foo'}      | ${false}
      ${'!@scope/*'} | ${'@other/foo'}      | ${true}
    `(
      'matches $packageName with $pnpm like pnpm: $matches',
      ({ pnpm, packageName, matches }) => {
        expect(
          matchRegexOrGlobList(packageName, [
            toMatchPackageNamesPattern(pnpm)!,
          ]),
        ).toBe(matches);
      },
    );
  });

  describe('parsePnpmMinimumReleaseAgeExclude()', () => {
    it('parses package names, patterns and exact versions', () => {
      expect(
        parsePnpmMinimumReleaseAgeExclude([
          'foo',
          '@scope/*',
          '!bar',
          '!*',
          'baz@1.0.0',
          '@scope/qux@1.0.0 || v2.0.0',
          'invalid@^1.0.0',
          'foo*@1.0.0',
          'foo?@1.0.0',
          '!foo@1.0.0',
        ]),
      ).toEqual({
        packageNames: ['foo', '/^@scope/.*$/', '!bar'],
        versions: [
          { packageName: 'baz', versions: ['1.0.0'] },
          { packageName: '@scope/qux', versions: ['1.0.0', '2.0.0'] },
        ],
      });
    });

    it('returns no entries without minimumReleaseAgeExclude', () => {
      expect(parsePnpmMinimumReleaseAgeExclude(undefined)).toEqual({
        packageNames: [],
        versions: [],
      });
    });
  });

  describe('isPnpmMinimumReleaseAgeExcluded()', () => {
    const exclude = parsePnpmMinimumReleaseAgeExclude([
      '@scope/*',
      'foo@1.0.0 || 2.0.0',
    ]);

    it.each`
      packageName   | version      | excluded
      ${'@scope/a'} | ${'3.0.0'}   | ${true}
      ${'foo'}      | ${'2.0.0'}   | ${true}
      ${'foo'}      | ${'3.0.0'}   | ${false}
      ${'foo'}      | ${undefined} | ${false}
      ${'bar'}      | ${'1.0.0'}   | ${false}
    `(
      'returns $excluded for $packageName@$version',
      ({ packageName, version, excluded }) => {
        expect(
          isPnpmMinimumReleaseAgeExcluded(exclude, packageName, version),
        ).toBe(excluded);
      },
    );
  });

  describe('getPnpmMinimumReleaseAgeMinutes()', () => {
    const npmrcMinutes = 2880;

    it.each`
      workspace                   | pnpm          | includeDefault | expected
      ${{}}                       | ${'^10.20.0'} | ${true}        | ${2880}
      ${{}}                       | ${'^10.20.0'} | ${false}       | ${2880}
      ${{ minimumReleaseAge: 0 }} | ${'^10.20.0'} | ${true}        | ${0}
      ${{ minimumReleaseAge: 0 }} | ${'^11.0.0'}  | ${true}        | ${0}
      ${{}}                       | ${'^11.0.0'}  | ${true}        | ${1440}
      ${{}}                       | ${'^11.0.0'}  | ${false}       | ${undefined}
      ${{}}                       | ${'>=10'}     | ${true}        | ${1440}
      ${{}}                       | ${'bananas'}  | ${true}        | ${1440}
      ${{}}                       | ${null}       | ${true}        | ${1440}
    `(
      'returns $expected for workspace=$workspace, pnpm $pnpm and includeDefault=$includeDefault',
      ({ workspace, pnpm, includeDefault, expected }) => {
        expect(
          getPnpmMinimumReleaseAgeMinutes(
            workspace,
            npmrcMinutes,
            pnpm,
            includeDefault,
          ),
        ).toBe(expected);
      },
    );

    it('returns undefined for pnpm v10 without a setting', () => {
      expect(
        getPnpmMinimumReleaseAgeMinutes({}, null, '^10.20.0', true),
      ).toBeUndefined();
    });
  });
});
