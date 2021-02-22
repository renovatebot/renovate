import { detectMonorepos } from './monorepo';

describe('manager/npm/extract', () => {
  describe('.extractPackageFile()', () => {
    it('uses lerna package settings', () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['packages/*'],
          packages: ['packages/*'],
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
      ] as any;
      detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBe(true);
    });
    it('updates internal packges', () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['packages/*'],
          packages: ['packages/*'],
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
      ] as any;
      detectMonorepos(packageFiles, true);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBe(false);
    });
    it('uses yarn workspaces package settings with lerna', () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['oldpackages/*'],
          lernaClient: 'yarn',
          yarnWorkspacesPackages: ['packages/*'],
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
      detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
    });
    it('uses yarn workspaces package settings without lerna', () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          yarnWorkspacesPackages: 'packages/*',
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
      detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot();
    });
  });
});
