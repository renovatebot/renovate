import { getFixturePath, getName } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import { detectPnpmWorkspaces } from './pnpm';

describe(getName(), () => {
  describe('.detectPnpmWorkspaces()', () => {
    beforeAll(() => {
      setAdminConfig({ localDir: getFixturePath('pnpm-monorepo/', '..') });
    });

    it('uses pnpm workspaces', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'packages/b/package.json',
          packageJsonName: '@org/b',
          pnpmShrinkwrap: undefined as undefined | string,
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(
        packageFiles.every((packageFile) => packageFile.pnpmShrinkwrap)
      ).toBe(true);
    });

    it('skips when pnpm shrinkwrap file has already been provided', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });

    it('filters none matching packages', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        {
          packageFile: 'packages/a/package.json',
          packageJsonName: '@org/a',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'not-matching/b/package.json',
          packageJsonName: '@org/b',
          pnpmShrinkwrap: undefined as undefined | string,
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(
        packageFiles.find(
          (packageFile) =>
            packageFile.packageFile === 'not-matching/b/package.json'
        ).pnpmShrinkwrap
      ).not.toBeDefined();
    });
  });
});
