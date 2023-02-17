import type { PackageFile } from '../../types';
import { detectMonorepos } from './monorepo';

jest.mock('./pnpm');

describe('modules/manager/npm/extract/monorepo', () => {
  describe('.extractPackageFile()', () => {
    it('uses lerna package settings', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
          lernaPackages: ['packages/*'],
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
            {
              depName: 'foo',
            },
          ],
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
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
          packageJsonName: '@org/b',
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData?.lernaJsonFile).toBe('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.isInternal)
        )
      ).toBeTrue();
    });

    it('updates internal packages', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
          lernaPackages: ['packages/*'],
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
            {
              depName: 'foo',
            },
          ],
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
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
          packageJsonName: '@org/b',
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData?.lernaJsonFile).toBe('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.isInternal)
        )
      ).toBeTrue();
    });

    it('uses yarn workspaces package settings with lerna', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
          lernaPackages: ['oldpackages/*'],
          lernaClient: 'yarn',
          workspacesPackages: ['packages/*'],
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData?.lernaJsonFile).toBe('lerna.json');
    });

    it('uses yarn workspaces package settings without lerna', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          npmrc: '@org:registry=//registry.some.org\n',
          workspacesPackages: 'packages/*',
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
          yarnLock: 'yarn.lock',
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchObject([
        {},
        { npmrc: '@org:registry=//registry.some.org\n' },
        {},
      ]);
    });

    it('uses yarn workspaces package settings with extractedConstraints', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          workspacesPackages: ['docs'],
          skipInstalls: true, // coverage
          extractedConstraints: {
            node: '^14.15.0 || >=16.13.0',
            yarn: '3.2.1',
          },
          yarnLock: 'yarn.lock',
          managerData: {
            hasPackageManager: true,
          },
        },
        {
          packageFile: 'docs/package.json',
          packageJsonName: 'docs',
          yarnLock: 'yarn.lock',
          extractedConstraints: { yarn: '^3.2.0' },
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchObject([
        {
          extractedConstraints: {
            node: '^14.15.0 || >=16.13.0',
            yarn: '3.2.1',
          },
          managerData: {
            hasPackageManager: true,
          },
        },
        {
          extractedConstraints: {
            node: '^14.15.0 || >=16.13.0',
            yarn: '^3.2.0',
          },
          managerData: {
            hasPackageManager: true,
          },
        },
      ]);
    });

    it('uses yarnZeroInstall and skipInstalls from yarn workspaces package settings', async () => {
      const packageFiles: Partial<PackageFile>[] = [
        {
          packageFile: 'package.json',
          managerData: {
            yarnZeroInstall: true,
          },
          skipInstalls: false,
          npmrc: '@org:registry=//registry.some.org\n',
          workspacesPackages: 'packages/*',
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
          yarnLock: 'yarn.lock',
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
          skipInstalls: true,
        },
      ];
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchObject([
        {},
        { managerData: { yarnZeroInstall: true }, skipInstalls: false },
        { managerData: { yarnZeroInstall: true }, skipInstalls: false },
      ]);
    });
  });
});
