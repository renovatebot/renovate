import { fs } from '~test/util.ts';
import {
  getConfigType,
  getLockFileName,
  getLockedVersion,
} from './lockfile.ts';
import type { MiseLockFile } from './schema.ts';

vi.mock('../../../util/fs/index.ts');

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
    `('returns $expected for $configPath', async ({ configPath, expected }) => {
      await expect(getLockFileName(configPath)).resolves.toBe(expected);
    });

    it('returns the monorepo root lock file when no colocated lock file exists', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('mise.lock');
      await expect(getLockFileName('packages/a/mise.toml')).resolves.toBe(
        'mise.lock',
      );
      expect(fs.findLocalSiblingOrParent).toHaveBeenCalledWith(
        'packages/a/mise.lock',
        'mise.lock',
      );
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
      expect(getLockedVersion(lockFileData, depName)).toBe(expected);
    });

    it('returns first version when multiple versions exist', () => {
      expect(getLockedVersion(lockFileData, 'python')).toBe('3.10.17');
    });

    describe('with specifiers', () => {
      const rootLockFileData: MiseLockFile = {
        tools: {
          node: [
            { version: '24.21.0', specifiers: ['24.21.0'] },
            { version: '22.19.0', specifiers: ['22'] },
            { version: '20.11.0' },
          ],
          pnpm: [{ version: '11.25.0' }],
        },
      };

      it.each`
        depName        | currentValue | expected
        ${'node'}      | ${'22'}      | ${'22.19.0'}
        ${'core:node'} | ${'24.21.0'} | ${'24.21.0'}
        ${'node'}      | ${'20'}      | ${undefined}
        ${'node'}      | ${undefined} | ${'24.21.0'}
        ${'pnpm'}      | ${'11'}      | ${'11.25.0'}
      `(
        'returns $expected for $depName = $currentValue',
        ({ depName, currentValue, expected }) => {
          expect(
            getLockedVersion(rootLockFileData, depName, currentValue),
          ).toBe(expected);
        },
      );
    });

    it('handles tools with bracket options in name', () => {
      // depName from extraction has brackets stripped by regex,
      // so we test the full backend-qualified name
      expect(
        getLockedVersion(lockFileData, 'ubi:cargo-bins/cargo-binstall'),
      ).toBe('1.10.21');
    });
  });
});
