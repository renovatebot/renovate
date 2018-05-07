const {
  detectMonorepos,
} = require('../../../../lib/manager/npm/extract/monorepo');

describe('manager/npm/extract', () => {
  describe('.extractDependencies()', () => {
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
      expect(packageFiles[1].monorepoPackages).toEqual(['@org/b']);
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
      expect(packageFiles[1].monorepoPackages).toEqual(['@org/b']);
    });
  });
});
