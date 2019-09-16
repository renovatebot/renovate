import { detectMonorepos } from '../../../../lib/manager/npm/extract/monorepo';

describe('manager/npm/extract', () => {
  describe('.extractPackageFile()', () => {
    it('uses lerna package settings', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          lernaDir: '.',
          lernaPackages: ['packages/*'],
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
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect((packageFiles[1] as any).internalPackages).toEqual(['@org/b']);
    });
    it('uses yarn workspaces package settings', async () => {
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
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles[1].lernaDir).toEqual('.');
      expect((packageFiles[1] as any).internalPackages).toEqual(['@org/b']);
    });
    it('uses yarn workspaces package settings', async () => {
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
      await detectMonorepos(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect((packageFiles[1] as any).internalPackages).toEqual(['@org/b']);
    });
  });
});
