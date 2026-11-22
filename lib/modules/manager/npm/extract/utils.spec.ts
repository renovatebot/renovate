import { groupByLockFile, matchesAnyPattern } from './utils.ts';

describe('modules/manager/npm/extract/utils', () => {
  describe('.matchesAnyPattern()', () => {
    it('matches package in nested directory', () => {
      const packageFile = 'packages/group/a/package.json';
      const packageFilters = ['packages/**'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });

    it('matches package in non-nested directory', () => {
      const packageFile = 'non-nested-packages/a/package.json';
      const packageFilters = ['non-nested-packages/*/*'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });

    it('matches package in explicitly defined directory', () => {
      const packageFile = 'solo-package/package.json';
      const packageFilters = ['solo-package/*'];

      const isPackageInWorkspace = matchesAnyPattern(
        packageFile,
        packageFilters,
      );

      expect(isPackageInWorkspace).toBeTrue();
    });
  });

  describe('.groupByLockFile()', () => {
    it('groups the package files by lock file with the root package.json', () => {
      const root = {
        packageFile: 'a/package.json',
        managerData: { pnpmLockFile: 'a/pnpm-lock.yaml' },
      };
      const workspace = {
        packageFile: 'a/pnpm-workspace.yaml',
        managerData: { pnpmLockFile: 'a/pnpm-lock.yaml' },
      };
      const member = {
        packageFile: 'a/pkgs/b/package.json',
        managerData: { pnpmLockFile: 'a/pnpm-lock.yaml' },
      };
      const other = {
        packageFile: 'c/pkgs/d/package.json',
        managerData: { pnpmLockFile: 'c/pnpm-lock.yaml' },
      };
      const otherWorkspace = {
        packageFile: 'c/pnpm-workspace.yaml',
        managerData: { pnpmLockFile: 'c/pnpm-lock.yaml' },
      };

      expect(
        groupByLockFile(
          [
            workspace,
            member,
            root,
            otherWorkspace,
            other,
            { packageFile: 'e/package.json', managerData: {} },
            { packageFile: 'f/package.json' },
          ],
          'pnpmLockFile',
        ),
      ).toEqual([
        {
          lockFile: 'a/pnpm-lock.yaml',
          packageFiles: [workspace, member, root],
          root,
        },
        {
          lockFile: 'c/pnpm-lock.yaml',
          packageFiles: [otherWorkspace, other],
          root: other,
        },
      ]);
    });

    it('returns no root without a package.json', () => {
      const workspace = {
        packageFile: 'a/pnpm-workspace.yaml',
        managerData: { pnpmLockFile: 'a/pnpm-lock.yaml' },
      };

      expect(groupByLockFile([workspace], 'pnpmLockFile')).toEqual([
        {
          lockFile: 'a/pnpm-lock.yaml',
          packageFiles: [workspace],
          root: undefined,
        },
      ]);
    });
  });
});
