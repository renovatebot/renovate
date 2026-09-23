import {
  getConfigType,
  getLockFileName,
  getLockedVersion,
} from './lockfile.ts';
import type { MiseLockFile } from './schema.ts';

describe('modules/manager/mise/lockfile', () => {
  describe('getConfigType()', () => {
    it.each`
      configPath                | isLocal  | env
      ${'mise.toml'}            | ${false} | ${undefined}
      ${'.mise.toml'}           | ${false} | ${undefined}
      ${'mise.local.toml'}      | ${true}  | ${undefined}
      ${'mise.test.toml'}       | ${false} | ${'test'}
      ${'mise.test.local.toml'} | ${true}  | ${'test'}
      ${'config.toml'}          | ${false} | ${undefined}
    `(
      'returns isLocal=$isLocal env=$env for $configPath',
      ({ configPath, isLocal, env }) => {
        expect(getConfigType(configPath)).toEqual({ isLocal, env });
      },
    );
  });

  describe('getLockFileName()', () => {
    it.each`
      configPath                    | expected
      ${'mise.toml'}                | ${'mise.lock'}
      ${'.mise.toml'}               | ${'mise.lock'}
      ${'config.toml'}              | ${'mise.lock'}
      ${'mise.test.toml'}           | ${'mise.test.lock'}
      ${'mise.staging.toml'}        | ${'mise.staging.lock'}
      ${'mise.local.toml'}          | ${'mise.local.lock'}
      ${'mise.test.local.toml'}     | ${'mise.test.local.lock'}
      ${'subdir/mise.toml'}         | ${'subdir/mise.lock'}
      ${'subdir/mise.prod.toml'}    | ${'subdir/mise.prod.lock'}
      ${'conf.d/python.toml'}       | ${'mise.lock'}
      ${'project/conf.d/node.toml'} | ${'project/mise.lock'}
    `('returns $expected for $configPath', ({ configPath, expected }) => {
      expect(getLockFileName(configPath)).toBe(expected);
    });
  });

  describe('getLockedVersion()', () => {
    const lockFileData: MiseLockFile = {
      tools: {
        node: [{ version: '20.11.0' }],
        python: [{ version: '3.10.17' }, { version: '3.11.12' }],
        'aqua:cli/cli': [{ version: '2.64.0' }],
        'ubi:cargo-bins/cargo-binstall': [{ version: '1.10.21' }],
      },
    };

    it.each`
      depName                            | expected
      ${'node'}                          | ${'20.11.0'}
      ${'core:node'}                     | ${'20.11.0'}
      ${'asdf:node'}                     | ${'20.11.0'}
      ${'python'}                        | ${'3.10.17'}
      ${'core:python'}                   | ${'3.10.17'}
      ${'aqua:cli/cli'}                  | ${'2.64.0'}
      ${'ubi:cargo-bins/cargo-binstall'} | ${'1.10.21'}
      ${'unknown'}                       | ${undefined}
      ${'core:unknown'}                  | ${undefined}
    `('returns $expected for $depName', ({ depName, expected }) => {
      expect(getLockedVersion(lockFileData, depName, 'latest')).toBe(expected);
    });

    it('returns first version when multiple versions exist', () => {
      expect(getLockedVersion(lockFileData, 'python', '3.10')).toBe('3.10.17');
    });

    it('handles tools with bracket options in name', () => {
      // depName from extraction has brackets stripped by regex,
      // so we test the full backend-qualified name
      expect(
        getLockedVersion(lockFileData, 'ubi:cargo-bins/cargo-binstall', '1'),
      ).toBe('1.10.21');
    });

    it.each`
      depName        | currentValue | expected
      ${'node'}      | ${'20'}      | ${'20.20.2'}
      ${'node'}      | ${'24'}      | ${'24.21.0'}
      ${'core:node'} | ${'24'}      | ${'24.21.0'}
      ${'node'}      | ${'lts'}     | ${'24.21.0'}
      ${'node'}      | ${'22'}      | ${undefined}
    `(
      'matches $depName selector $currentValue to $expected',
      ({ depName, currentValue, expected }) => {
        const lockFileData: MiseLockFile = {
          tools: {
            node: [
              { version: '20.20.2', specifiers: ['20'] },
              { version: '22.23.2' },
              { version: '24.21.0', specifiers: ['24', 'lts'] },
            ],
          },
        };

        expect(getLockedVersion(lockFileData, depName, currentValue)).toBe(
          expected,
        );
      },
    );
  });
});
