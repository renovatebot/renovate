import { detectMonorepos } from './monorepo';

jest.mock('./pnpm');

describe('manager/npm/extract/monorepo', () => {
  describe('.extractPackageFile()', () => {
    it('uses lerna package settings', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
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
      await detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData.lernaJsonFile).toBe('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBeTrue();
    });

    it('updates internal packages', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
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
      await detectMonorepos(packageFiles, true);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData.lernaJsonFile).toBe('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBeFalse();
    });

    it('uses yarn workspaces package settings with lerna', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: {
            lernaJsonFile: 'lerna.json',
          },
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
      await detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].managerData.lernaJsonFile).toBe('lerna.json');
    });

    it('uses yarn workspaces package settings without lerna', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          npmrc: '@org:registry=//registry.some.org\n',
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
      await detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot([
        {},
        { npmrc: '@org:registry=//registry.some.org\n' },
        {},
      ]);
    });

    it('uses yarnZeroInstall and skipInstalls from yarn workspaces package settings', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: {
            yarnZeroInstall: true,
          },
          skipInstalls: false,
          npmrc: '@org:registry=//registry.some.org\n',
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
          skipInstalls: true,
        },
      ];
      await detectMonorepos(packageFiles, false);
      expect(packageFiles).toMatchSnapshot([
        {},
        { managerData: { yarnZeroInstall: true }, skipInstalls: false },
        { managerData: { yarnZeroInstall: true }, skipInstalls: false },
      ]);
    });
  });
});
