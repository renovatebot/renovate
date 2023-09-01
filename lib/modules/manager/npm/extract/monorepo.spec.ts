import type { PackageFile } from '../../types';
import { detectMonorepos } from './monorepo';

describe('modules/manager/npm/extract/monorepo', () => {
  describe('.extractPackageFile()', () => {
    it('handles no monorepo', () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          deps: [],
        },
      ];
      detectMonorepos(packageFiles);
      expect(packageFiles).toHaveLength(1);
    });

    it('updates internal packages', () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          managerData: {
            workspacesPackages: ['packages/*'],
          },
          deps: [
            {
              depName: '@org/a',
            },
            {
              depName: '@org/b',
            },
            {
              depName: '@org/c',
            },
          ],
        },
        {
          packageFile: 'packages/a/package.json',
          managerData: { packageJsonName: '@org/a' },
          deps: [
            {
              depName: '@org/b',
            },
            {
              depName: '@org/c',
            },
            {
              depName: 'bar',
            },
          ],
        },
        {
          packageFile: 'packages/b/package.json',
          managerData: { packageJsonName: '@org/b' },
        },
      ];
      detectMonorepos(packageFiles);
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.isInternal)
        )
      ).toBeTrue();
    });
  });
});
