import type {
  PackageFile,
  SharedConstraint,
  SharedConstraints,
  SharedConstraintsScope,
} from '../../../modules/manager/types.ts';
import {
  type ConstraintName,
  isConstraintName,
} from '../../../util/exec/types.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import {
  collectSharedConstraints,
  getSharedConstraints,
  updateSharedConstraints,
} from './shared-constraints.ts';

function packageFile(
  path: string,
  sharedConstraintsScope?: SharedConstraintsScope,
): PackageFile {
  return { packageFile: path, deps: [], sharedConstraintsScope };
}

function constraints(
  values: Record<string, string | null>,
): Partial<Record<ConstraintName, SharedConstraint>> {
  const res: Partial<Record<ConstraintName, SharedConstraint>> = {};
  for (const [name, value] of Object.entries(values)) {
    if (isConstraintName(name)) {
      res[name] = { depName: name, value };
    }
  }
  return res;
}

function scope(
  values: Record<string, string | null>,
  directory = '',
  precedence = 0,
): SharedConstraintsScope {
  return { directory, precedence, constraints: constraints(values) };
}

function shared(
  path: string,
  values: Record<string, string | null>,
  directory = '',
  precedence = 0,
  manager = 'tools',
): SharedConstraints {
  return {
    ...scope(values, directory, precedence),
    manager,
    packageFile: path,
  };
}

function upgrade(config: Partial<BranchUpgradeConfig>): BranchUpgradeConfig {
  return {
    manager: 'tools',
    packageFile: 'tools.toml',
    depName: 'node',
    branchName: 'some-branch',
    ...config,
  };
}

describe('workers/repository/extract/shared-constraints', () => {
  describe('collectSharedConstraints()', () => {
    it('ignores package files without shared constraints', () => {
      const packageFiles = {
        npm: [
          {
            ...packageFile('package.json'),
            extractedConstraints: { node: '20' },
          },
        ],
        tools: [packageFile('tools.toml', scope({}))],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([]);
    });

    it('orders the package files by depth, precedence and path in byte order', () => {
      const packageFiles = {
        tools: [
          packageFile(
            'apps/web/tools.toml',
            scope({ pnpm: '9.15.0' }, 'apps/web'),
          ),
          packageFile('tools.local.toml', scope({ node: '22.0.0' }, '', 1)),
          packageFile('conf.d/a.toml', scope({ rust: '1.80.0' })),
          packageFile('conf.d/B.toml', scope({ rust: null })),
        ],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([
        shared('conf.d/B.toml', { rust: null }),
        shared('conf.d/a.toml', { rust: '1.80.0' }),
        shared('tools.local.toml', { node: '22.0.0' }, '', 1),
        shared('apps/web/tools.toml', { pnpm: '9.15.0' }, 'apps/web'),
      ]);
    });

    it('orders the package files by manager before depth and precedence', () => {
      const packageFiles = {
        mise: [packageFile('mise.toml', scope({ rust: '1.80.0' }))],
        tools: [packageFile('a/tools.toml', scope({ rust: null }, 'a', 9))],
        other: [
          packageFile('a/b/other.toml', scope({ rust: '1.85.0' }, 'a/b')),
        ],
      };

      expect(collectSharedConstraints(packageFiles)).toEqual([
        shared('a/b/other.toml', { rust: '1.85.0' }, 'a/b', 0, 'other'),
        shared('a/tools.toml', { rust: null }, 'a', 9),
        shared('mise.toml', { rust: '1.80.0' }, '', 0, 'mise'),
      ]);
    });
  });

  describe('getSharedConstraints()', () => {
    const sharedConstraints = [
      shared('tools.toml', { node: '20.11.0', pnpm: '9.15.0' }),
      shared('tools.local.toml', { node: '20.12.0' }, '', 1),
      shared('apps/web/tools.toml', { pnpm: '10.16.1' }, 'apps/web'),
    ];

    it.each`
      packageFile                       | expected
      ${'package.json'}                 | ${{ node: '20.12.0', pnpm: '9.15.0' }}
      ${'apps/web/package.json'}        | ${{ node: '20.12.0', pnpm: '10.16.1' }}
      ${'apps/web/nested/package.json'} | ${{ node: '20.12.0', pnpm: '10.16.1' }}
      ${'apps/web-client/package.json'} | ${{ node: '20.12.0', pnpm: '9.15.0' }}
    `('returns $expected for $packageFile', ({ packageFile, expected }) => {
      expect(
        getSharedConstraints(sharedConstraints, 'npm', packageFile),
      ).toEqual(expected);
    });

    it('ignores constraints which are no tools', () => {
      expect(
        getSharedConstraints(
          [shared('tools.toml', { go: '1.22.0', node: '20.11.0' })],
          'npm',
          'package.json',
        ),
      ).toEqual({ node: '20.11.0' });
    });

    it('ignores constraints outside of the directory', () => {
      expect(
        getSharedConstraints(
          [shared('apps/api/tools.toml', { node: '20' }, 'apps/api')],
          'npm',
          'apps/web/package.json',
        ),
      ).toEqual({});
    });

    it('does not apply the constraints of a manager to its own package files', () => {
      expect(
        getSharedConstraints(sharedConstraints, 'tools', 'apps/web/tools.toml'),
      ).toEqual({});
    });

    it.each`
      manager             | name      | files                                                                                        | file                 | expected
      ${'rust-toolchain'} | ${'rust'} | ${[['rust-toolchain.toml', '', 0, '1.80.0'], ['fuzz/rust-toolchain.toml', 'fuzz', 0, null]]} | ${'fuzz/Cargo.toml'} | ${{}}
      ${'rust-toolchain'} | ${'rust'} | ${[['rust-toolchain.toml', '', 0, '1.80.0'], ['rust-toolchain', '', 1, null]]}               | ${'Cargo.toml'}      | ${{}}
      ${'rust-toolchain'} | ${'rust'} | ${[['rust-toolchain.toml', '', 0, null], ['rust-toolchain', '', 1, '1.80.0']]}               | ${'Cargo.toml'}      | ${{ rust: '1.80.0' }}
      ${'mise'}           | ${'node'} | ${[['mise.toml', '', 7, '20.11.0'], ['apps/web/mise.toml', 'apps/web', 7, null]]}            | ${'apps/web/x.json'} | ${{}}
      ${'mise'}           | ${'node'} | ${[['mise.toml', '', 7, '20.11.0'], ['apps/web/mise.toml', 'apps/web', 7, null]]}            | ${'apps/x.json'}     | ${{ node: '20.11.0' }}
    `(
      'returns $expected for $file with the $manager files $files',
      ({ manager, name, files, file, expected }) => {
        const packageFiles = {
          [manager]: (files as [string, string, number, string | null][]).map(
            ([path, directory, precedence, value]) =>
              packageFile(
                path,
                scope({ [name]: value }, directory, precedence),
              ),
          ),
        };

        const res = getSharedConstraints(
          collectSharedConstraints(packageFiles),
          'consumer',
          file,
        );

        expect(res).toEqual(expected);
      },
    );

    it.each`
      mise                  | expected
      ${{ rust: '1.80.0' }} | ${{ rust: '1.80.0' }}
      ${{ rust: null }}     | ${{}}
      ${{ node: '22.0.0' }} | ${{ node: '22.0.0', rust: '1.85.0' }}
    `(
      'returns $expected for the mise tools $mise over a nested rust-toolchain file',
      ({ mise, expected }) => {
        const packageFiles = {
          mise: [packageFile('mise.toml', scope(mise))],
          'rust-toolchain': [
            packageFile(
              'fuzz/rust-toolchain.toml',
              scope({ rust: '1.85.0' }, 'fuzz'),
            ),
          ],
        };

        const res = getSharedConstraints(
          collectSharedConstraints(packageFiles),
          'cargo',
          'fuzz/Cargo.toml',
        );

        expect(res).toEqual(expected);
      },
    );
  });

  describe('updateSharedConstraints()', () => {
    const sharedConstraints = [
      shared('tools.toml', { node: '20.11.0', pnpm: '9.15.0' }),
    ];

    it.each`
      config                                                                            | expected
      ${{ currentValue: '20.11.0', newVersion: '22.1.0' }}                              | ${'22.1.0'}
      ${{ currentValue: '20', lockedVersion: '20.11.0', newVersion: '20.12.0' }}        | ${'20.12.0'}
      ${{ currentValue: '^20', currentVersion: '20.11.0', newVersion: '22.1.0' }}       | ${'22.1.0'}
      ${{ currentValue: '20.11.0', newVersion: '22' }}                                  | ${null}
      ${{ currentValue: '20.10.0', newVersion: '22.1.0' }}                              | ${'20.11.0'}
      ${{ currentValue: '20.11.0' }}                                                    | ${'20.11.0'}
      ${{ currentValue: '20.11.0', newVersion: '22.1.0', depName: 'nodejs' }}           | ${'20.11.0'}
      ${{ currentValue: '20.11.0', newVersion: '22.1.0', packageFile: 'a/tools.toml' }} | ${'20.11.0'}
      ${{ currentValue: '20.11.0', newVersion: '22.1.0', manager: 'other' }}            | ${'20.11.0'}
      ${{ currentValue: '20.11.0', newVersion: '22.1.0', updateType: 'replacement' }}   | ${'20.11.0'}
    `('returns $expected for $config', ({ config, expected }) => {
      const res = updateSharedConstraints(sharedConstraints, [upgrade(config)]);

      expect(res).toEqual([
        shared('tools.toml', { node: expected, pnpm: '9.15.0' }),
      ]);
      expect(sharedConstraints).toEqual([
        shared('tools.toml', { node: '20.11.0', pnpm: '9.15.0' }),
      ]);
    });

    it('uses the versioning of the tool for the new version', () => {
      const res = updateSharedConstraints(
        [
          shared(
            'rust-toolchain.toml',
            { rust: '1.84' },
            '',
            0,
            'rust-toolchain',
          ),
        ],
        [
          upgrade({
            manager: 'rust-toolchain',
            packageFile: 'rust-toolchain.toml',
            depName: 'rust',
            currentValue: '1.84',
            newVersion: '1.91.1',
          }),
        ],
      );

      expect(res).toEqual([
        shared(
          'rust-toolchain.toml',
          { rust: '1.91.1' },
          '',
          0,
          'rust-toolchain',
        ),
      ]);
    });

    it('does not update constraints which are no tools', () => {
      const sharedGo = [shared('tools.toml', { go: '1.22.0' })];

      const res = updateSharedConstraints(sharedGo, [
        upgrade({
          depName: 'go',
          currentValue: '1.22.0',
          newVersion: '1.23.0',
        }),
      ]);

      expect(res).toEqual(sharedGo);
    });
  });
});
