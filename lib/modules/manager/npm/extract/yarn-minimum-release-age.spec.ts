import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { logger } from '../../../../logger/index.ts';
import type { PackageFile } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import {
  getYarnMinimalAgeGateMinutes,
  getYarnMinimumReleaseAgeRules,
  getYarnScopeMinimalAgeGateMinutes,
  isYarn1Constraint,
  isYarnPreapproved,
  parseYarnDurationMinutes,
  parseYarnPreapprovedPackages,
  readYarnrcMinimalAgeGate,
  setYarnMinimumReleaseAge,
} from './yarn-minimum-release-age.ts';

vi.mock('../../../../util/fs/index.ts');

function mockYarnrc(content: string | null): void {
  fs.readLocalFile.mockImplementation((fileName: string) =>
    Promise.resolve(fileName === 'some-dir/.yarnrc.yml' ? content : null),
  );
}

describe('modules/manager/npm/extract/yarn-minimum-release-age', () => {
  describe('parseYarnDurationMinutes()', () => {
    it.each`
      value        | expected
      ${1440}      | ${1440}
      ${'1440'}    | ${1440}
      ${'1.5'}     | ${1.5}
      ${'.5h'}     | ${30}
      ${'90s'}     | ${1.5}
      ${'60000ms'} | ${1}
      ${'30m'}     | ${30}
      ${'12h'}     | ${720}
      ${'3d'}      | ${4320}
      ${'1w'}      | ${10080}
      ${0}         | ${0}
      ${-1}        | ${null}
      ${'3 days'}  | ${null}
      ${'1y'}      | ${null}
      ${'1 h'}     | ${null}
      ${true}      | ${null}
      ${null}      | ${null}
    `('returns $expected for $value', ({ value, expected }) => {
      expect(parseYarnDurationMinutes(value)).toBe(expected);
    });
  });

  describe('readYarnrcMinimalAgeGate()', () => {
    it.each`
      content                                                                | expected
      ${null}                                                                | ${{}}
      ${'nodeLinker: node-modules\n'}                                        | ${{}}
      ${'- not a mapping\n'}                                                 | ${{}}
      ${'npmMinimalAgeGate: 3d\n'}                                           | ${{ npmMinimalAgeGate: 4320 }}
      ${'npmMinimalAgeGate: 0\n'}                                            | ${{ npmMinimalAgeGate: 0 }}
      ${'npmMinimalAgeGate: bananas\n'}                                      | ${{}}
      ${'npmPreapprovedPackages:\n  - foo\n'}                                | ${{ npmPreapprovedPackages: ['foo'] }}
      ${'npmPreapprovedPackages: foo,bar\n'}                                 | ${{ npmPreapprovedPackages: ['foo', 'bar'] }}
      ${'npmPreapprovedPackages: 1\n'}                                       | ${{}}
      ${'npmScopes:\n  myorg:\n    npmMinimalAgeGate: 1h\n'}                 | ${{ npmScopes: { myorg: 60 } }}
      ${'npmScopes:\n  myorg:\n    npmRegistryServer: https://x\n'}          | ${{ npmScopes: { myorg: null } }}
      ${'npmScopes:\n  myorg:\n'}                                            | ${{ npmScopes: { myorg: null } }}
      ${'npmScopes:\n  myorg:\n    npmMinimalAgeGate: bananas\n'}            | ${{ npmScopes: { myorg: null } }}
      ${'npmScopes: 1\n'}                                                    | ${{}}
      ${'npmMinimalAgeGate: 1h\nnpmScopes:\n  a:\n    npmMinimalAgeGate: 0'} | ${{ npmMinimalAgeGate: 60, npmScopes: { a: 0 } }}
    `('returns $expected for $content', async ({ content, expected }) => {
      mockYarnrc(content);

      await expect(
        readYarnrcMinimalAgeGate('some-dir/yarn.lock'),
      ).resolves.toEqual(expected);
    });
  });

  describe('isYarn1Constraint()', () => {
    it.each`
      constraint   | expected
      ${undefined} | ${true}
      ${'latest'}  | ${true}
      ${'^1.22.0'} | ${true}
      ${'>=1.22'}  | ${true}
      ${'^3.0.0'}  | ${false}
      ${'4.12.0'}  | ${false}
    `('returns $expected for $constraint', ({ constraint, expected }) => {
      expect(isYarn1Constraint(constraint)).toBe(expected);
    });
  });

  describe('getYarnMinimalAgeGateMinutes()', () => {
    it.each`
      settings                       | includeDefault | expected
      ${{ npmMinimalAgeGate: 60 }}   | ${true}        | ${60}
      ${{ npmMinimalAgeGate: 0 }}    | ${true}        | ${0}
      ${{}}                          | ${true}        | ${1440}
      ${{}}                          | ${false}       | ${undefined}
      ${{ npmMinimalAgeGate: 4320 }} | ${false}       | ${4320}
    `(
      'returns $expected for $settings and includeDefault=$includeDefault',
      ({ settings, includeDefault, expected }) => {
        expect(getYarnMinimalAgeGateMinutes(settings, includeDefault)).toBe(
          expected,
        );
      },
    );
  });

  describe('getYarnScopeMinimalAgeGateMinutes()', () => {
    it.each`
      settings                             | includeDefault | expected
      ${{}}                                | ${true}        | ${{}}
      ${{ npmScopes: { a: 60, b: null } }} | ${true}        | ${{ a: 60, b: 1440 }}
      ${{ npmScopes: { a: 60, b: null } }} | ${false}       | ${{ a: 60 }}
      ${{ npmScopes: { a: 0 } }}           | ${false}       | ${{ a: 0 }}
    `(
      'returns $expected for $settings and includeDefault=$includeDefault',
      ({ settings, includeDefault, expected }) => {
        expect(
          getYarnScopeMinimalAgeGateMinutes(settings, includeDefault),
        ).toEqual(expected);
      },
    );
  });

  describe('parseYarnPreapprovedPackages()', () => {
    it('parses package names, globs and ranges', () => {
      expect(
        parseYarnPreapprovedPackages([
          'foo',
          '@scope/*',
          'release-*',
          'bar@^1.0.0',
          '@scope/baz@1.2.3',
          '/not/a/descriptor',
        ]),
      ).toEqual([
        { packageName: 'foo' },
        { packageName: '@scope/*' },
        { packageName: 'release-*' },
        { packageName: 'bar', range: '^1.0.0' },
        { packageName: '@scope/baz', range: '1.2.3' },
      ]);
    });

    it('returns no entries without npmPreapprovedPackages', () => {
      expect(parseYarnPreapprovedPackages(undefined)).toEqual([]);
    });
  });

  describe('isYarnPreapproved()', () => {
    const preapproved = parseYarnPreapprovedPackages([
      'foo',
      '@scope/*',
      'bar@^1.0.0',
      'baz@bananas',
    ]);

    it.each`
      packageName     | version      | expected
      ${'foo'}        | ${'1.0.0'}   | ${true}
      ${'@scope/a'}   | ${'1.0.0'}   | ${true}
      ${'@scope/a/b'} | ${'1.0.0'}   | ${false}
      ${'bar'}        | ${'1.2.0'}   | ${true}
      ${'bar'}        | ${'2.0.0'}   | ${false}
      ${'bar'}        | ${undefined} | ${false}
      ${'baz'}        | ${'1.0.0'}   | ${false}
      ${'qux'}        | ${'1.0.0'}   | ${false}
    `(
      'returns $expected for $packageName@$version',
      ({ packageName, version, expected }) => {
        expect(isYarnPreapproved(preapproved, packageName, version)).toBe(
          expected,
        );
      },
    );
  });

  describe('getYarnMinimumReleaseAgeRules()', () => {
    const preapproved = parseYarnPreapprovedPackages(['foo', 'bar@^1.0.0']);

    it('adds rules for the global age, the scopes and the preapproved packages', () => {
      expect(
        getYarnMinimumReleaseAgeRules(4320, { a: 60, b: 0 }, preapproved),
      ).toEqual([
        {
          matchDatasources: ['npm'],
          minimumReleaseAgeExtracted: '4320 minutes',
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@a/**'],
          minimumReleaseAgeExtracted: '60 minutes',
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@b/**'],
          minimumReleaseAgeExtracted: null,
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['foo'],
          minimumReleaseAgeExtracted: null,
        },
      ]);
    });

    it('adds the scope rules without a global age', () => {
      expect(getYarnMinimumReleaseAgeRules(0, { a: 60 }, [])).toEqual([
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@a/**'],
          minimumReleaseAgeExtracted: '60 minutes',
        },
      ]);
    });

    it.each`
      minutes      | scopeMinutes
      ${undefined} | ${{}}
      ${0}         | ${{ a: 0 }}
    `(
      'adds no rules for minutes=$minutes and scopes=$scopeMinutes',
      ({ minutes, scopeMinutes }) => {
        expect(
          getYarnMinimumReleaseAgeRules(minutes, scopeMinutes, preapproved),
        ).toEqual([]);
      },
    );
  });

  describe('setYarnMinimumReleaseAge()', () => {
    function packageFile(
      packageFile: string,
      managerData?: NpmManagerData,
      yarn?: string,
    ): Partial<PackageFile<NpmManagerData>> {
      return {
        packageFile,
        managerData,
        ...(yarn && { extractedConstraints: { yarn } }),
      };
    }

    function rule(minimumReleaseAgeExtracted: string) {
      return { matchDatasources: ['npm'], minimumReleaseAgeExtracted };
    }

    it('adds packageRules to the package files of each Yarn lock file', async () => {
      mockYarnrc('npmMinimalAgeGate: 3d\n');
      const existing = {
        matchPackageNames: ['foo'],
        minimumReleaseAgeExtracted: null,
      };
      const packageFiles = [
        packageFile(
          'some-dir/package.json',
          { yarnLock: 'some-dir/yarn.lock' },
          '4.12.0',
        ),
        {
          ...packageFile(
            'some-dir/pkgs/a/package.json',
            { yarnLock: 'some-dir/yarn.lock' },
            '4.12.0',
          ),
          packageRules: [existing],
        },
        packageFile('other/package.json', {
          npmLock: 'other/package-lock.json',
        }),
        packageFile('none/package.json'),
      ];

      await setYarnMinimumReleaseAge(packageFiles);

      expect(packageFiles.map((p) => p.packageRules)).toEqual([
        [rule('4320 minutes')],
        [existing, rule('4320 minutes')],
        undefined,
        undefined,
      ]);
      expect(
        packageFiles.map((p) => p.managerData?.yarnMinimalAgeGate),
      ).toEqual([
        { npmMinimalAgeGate: 4320, yarnConstraint: '4.12.0' },
        { npmMinimalAgeGate: 4320, yarnConstraint: '4.12.0' },
        undefined,
        undefined,
      ]);
      // the .yarnrc.yml is read once per lock file
      expect(fs.readLocalFile).toHaveBeenCalledOnce();
    });

    it('keeps the Yarn constraint of the root package.json for every package file of the lock file', async () => {
      mockYarnrc(null);
      const packageFiles = [
        packageFile('some-dir/.yarnrc.yml', { yarnLock: 'some-dir/yarn.lock' }),
        packageFile('some-dir/pkgs/a/package.json', {
          yarnLock: 'some-dir/yarn.lock',
        }),
        packageFile(
          'some-dir/package.json',
          { yarnLock: 'some-dir/yarn.lock' },
          '4.12.0',
        ),
      ];

      await setYarnMinimumReleaseAge(packageFiles);

      expect(
        packageFiles.map((p) => p.managerData?.yarnMinimalAgeGate),
      ).toEqual([
        { yarnConstraint: '4.12.0' },
        { yarnConstraint: '4.12.0' },
        { yarnConstraint: '4.12.0' },
      ]);
    });

    it('reads the Yarn constraint of another package file without a root package.json', async () => {
      mockYarnrc('npmMinimalAgeGate: 60\n');
      const packageFiles = [
        packageFile(
          'some-dir/pkgs/a/package.json',
          { yarnLock: 'some-dir/yarn.lock' },
          '^4.0.0',
        ),
      ];

      await setYarnMinimumReleaseAge(packageFiles);

      expect(packageFiles[0].packageRules).toEqual([rule('60 minutes')]);
    });

    it.each`
      yarn         | content
      ${undefined} | ${'npmMinimalAgeGate: 3d\n'}
      ${'^1.22.0'} | ${'npmMinimalAgeGate: 3d\n'}
      ${'4.20.0'}  | ${'npmMinimalAgeGate: 0\n'}
      ${'4.14.0'}  | ${null}
    `(
      'skips package files without a minimum release age for Yarn $yarn: $content',
      async ({ yarn, content }) => {
        mockYarnrc(content);
        const packageFiles = [
          packageFile(
            'some-dir/package.json',
            { yarnLock: 'some-dir/yarn.lock' },
            yarn,
          ),
        ];

        await setYarnMinimumReleaseAge(packageFiles);

        expect(packageFiles[0].packageRules).toBeUndefined();
      },
    );

    it.each`
      yarn        | expected
      ${'4.15.0'} | ${[rule('1440 minutes')]}
      ${'^4.0.0'} | ${[rule('1440 minutes')]}
      ${'>=3'}    | ${[rule('1440 minutes')]}
      ${'4.14.0'} | ${undefined}
      ${'^3.0.0'} | ${undefined}
    `(
      'adds the Yarn v4.15.0 default without a setting for Yarn $yarn',
      async ({ yarn, expected }) => {
        mockYarnrc('nodeLinker: node-modules\n');
        const packageFiles = [
          packageFile(
            'some-dir/package.json',
            { yarnLock: 'some-dir/yarn.lock' },
            yarn,
          ),
        ];

        await setYarnMinimumReleaseAge(packageFiles);

        expect(packageFiles[0].packageRules).toEqual(expected);
      },
    );

    it.each`
      yarn        | expected
      ${'4.17.0'} | ${'1440 minutes'}
      ${'4.16.0'} | ${undefined}
    `(
      'gives a scope without its own age the default for Yarn $yarn',
      async ({ yarn, expected }) => {
        mockYarnrc(codeBlock`
          npmMinimalAgeGate: 3d
          npmScopes:
            myorg:
              npmRegistryServer: https://npm.example.com
        `);
        const packageFiles = [
          packageFile(
            'some-dir/package.json',
            { yarnLock: 'some-dir/yarn.lock' },
            yarn,
          ),
        ];

        await setYarnMinimumReleaseAge(packageFiles);

        expect(
          packageFiles[0].packageRules?.find((r) =>
            r.matchPackageNames?.includes('@myorg/**'),
          )?.minimumReleaseAgeExtracted,
        ).toBe(expected);
        expect(packageFiles[0].managerData?.yarnMinimalAgeGate).toEqual({
          npmMinimalAgeGate: 4320,
          npmScopes: { myorg: null },
          yarnConstraint: yarn,
        });
      },
    );

    it('adds the scope rules without a global age', async () => {
      mockYarnrc(codeBlock`
        npmScopes:
          myorg:
            npmMinimalAgeGate: 2d
      `);
      const packageFiles = [
        packageFile(
          'some-dir/package.json',
          { yarnLock: 'some-dir/yarn.lock' },
          '4.12.0',
        ),
      ];

      await setYarnMinimumReleaseAge(packageFiles);

      expect(packageFiles[0].packageRules).toEqual([
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@myorg/**'],
          minimumReleaseAgeExtracted: '2880 minutes',
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        'Found Yarn minimum release age for some-dir/yarn.lock: global none, scopes @myorg 2880 minutes',
      );
    });

    it('honors the scopes and preapproved packages', async () => {
      mockYarnrc(codeBlock`
        npmMinimalAgeGate: 3d
        npmPreapprovedPackages:
          - '@types/*'
          - foo@^1.0.0
        npmScopes:
          myorg:
            npmMinimalAgeGate: 0
      `);
      const packageFiles = [
        packageFile(
          'some-dir/package.json',
          { yarnLock: 'some-dir/yarn.lock' },
          '4.17.0',
        ),
      ];

      await setYarnMinimumReleaseAge(packageFiles);

      expect(packageFiles[0].packageRules).toEqual([
        rule('4320 minutes'),
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@myorg/**'],
          minimumReleaseAgeExtracted: null,
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['@types/*'],
          minimumReleaseAgeExtracted: null,
        },
      ]);
    });

    it.each`
      content                                 | expected
      ${'npmPreapprovedPackages:\n  - foo\n'} | ${{ hasNpmPreapprovedPackages: true, yarnConstraint: '4.15.0' }}
      ${'npmPreapprovedPackages: []\n'}       | ${{ yarnConstraint: '4.15.0' }}
      ${'nodeLinker: node-modules\n'}         | ${{ yarnConstraint: '4.15.0' }}
    `(
      'keeps whether npmPreapprovedPackages has entries: $content',
      async ({ content, expected }) => {
        mockYarnrc(content);
        const packageFiles = [
          packageFile(
            'some-dir/package.json',
            { yarnLock: 'some-dir/yarn.lock' },
            '4.15.0',
          ),
        ];

        await setYarnMinimumReleaseAge(packageFiles);

        expect(packageFiles[0].managerData?.yarnMinimalAgeGate).toEqual(
          expected,
        );
      },
    );
  });
});
