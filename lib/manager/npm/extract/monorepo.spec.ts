import { getName } from '../../../../test/util';
import { detectMonorepos } from './monorepo';

jest.mock('./pnpm');

describe(getName(), () => {
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
      expect(packageFiles[1].managerData.lernaJsonFile).toEqual('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBe(true);
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
      expect(packageFiles[1].managerData.lernaJsonFile).toEqual('lerna.json');
      expect(
        packageFiles.some((packageFile) =>
          packageFile.deps?.some((dep) => dep.skipReason)
        )
      ).toBe(false);
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
      expect(packageFiles[1].managerData.lernaJsonFile).toEqual('lerna.json');
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
      expect(packageFiles).toMatchSnapshot();
    });
  });
});
