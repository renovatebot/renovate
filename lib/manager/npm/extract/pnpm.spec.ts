import yaml from 'js-yaml';
import { getFixturePath, getName, logger } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import * as fs from '../../../util/fs';
import {
  detectPnpmWorkspaces,
  extractPnpmFilters,
  findPnpmWorkspace,
} from './pnpm';

describe(getName(), () => {
  beforeAll(() => {
    setAdminConfig({ localDir: getFixturePath('pnpm-monorepo/', '..') });
  });

  describe('.extractPnpmFilters()', () => {
    it('detects errors in pnpm-workspace.yml file structure', async () => {
      jest
        .spyOn(fs, 'readLocalFile')
        .mockResolvedValueOnce('p!!!ckages:\n - "packages/*"');

      const workSpaceFilePath = getFixturePath(
        'pnpm-monorepo/pnpm-workspace.yml',
        '..'
      );
      const res = await extractPnpmFilters(workSpaceFilePath);

      expect(res).toMatchSnapshot();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        {
          fileName: expect.any(String),
        },
        'Failed to find required "packages" array in pnpm-workspace.yaml'
      );
    });

    it('detects errors when opening pnpm-workspace.yml file', async () => {
      jest.spyOn(yaml, 'load').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await extractPnpmFilters('pnpm-workspace.yml');

      expect(res).toMatchSnapshot();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.any(String),
          err: expect.anything(),
        }),
        'Failed to parse pnpm-workspace.yaml'
      );
    });
  });

  describe('.findPnpmWorkspace()', () => {
    it('detects missing pnpm-workspace.yaml', async () => {
      jest.spyOn(fs, 'findLocalSiblingOrParent').mockResolvedValueOnce(null);

      const packageFile = 'package.json';
      const res = await findPnpmWorkspace(packageFile);
      expect(res).toMatchSnapshot();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        expect.objectContaining({ packageFile }),
        'Failed to locate pnpm-workspace.yaml in a parent directory.'
      );
    });

    it('detects missing pnpm-lock.yaml when pnpm-workspace.yaml was already found', async () => {
      jest.spyOn(fs, 'localPathExists').mockResolvedValueOnce(false);

      const packageFile = 'package.json';
      const res = await findPnpmWorkspace(packageFile);
      expect(res).toMatchSnapshot();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceYamlPath: 'pnpm-workspace.yaml',
          packageFile,
        }),
        'Failed to find a pnpm-lock.yaml sibling for the workspace.'
      );
    });
  });

  describe('.detectPnpmWorkspaces()', () => {
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
