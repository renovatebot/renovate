import yaml from 'js-yaml';
import { getFixturePath, logger } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as fs from '../../../util/fs';
import {
  detectPnpmWorkspaces,
  extractPnpmFilters,
  findPnpmWorkspace,
} from './pnpm';

describe('manager/npm/extract/pnpm', () => {
  beforeAll(() => {
    GlobalConfig.set({ localDir: getFixturePath('pnpm-monorepo/', '..') });
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
      expect(res).toBeNull();
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
      expect(res).toBeNull();
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
      expect(res).toBeNull();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        expect.objectContaining({ packageFile }),
        'Failed to locate pnpm-workspace.yaml in a parent directory.'
      );
    });

    it('detects missing pnpm-lock.yaml when pnpm-workspace.yaml was already found', async () => {
      jest.spyOn(fs, 'localPathExists').mockResolvedValueOnce(false);

      const packageFile = 'package.json';
      const res = await findPnpmWorkspace(packageFile);
      expect(res).toBeNull();
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
          packageFile: 'nested-packages/group/a/package.json',
          packageJsonName: '@demo/nested-group-a',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'nested-packages/group/b/package.json',
          packageJsonName: '@demo/nested-group-b',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'non-nested-packages/a/package.json',
          packageJsonName: '@demo/non-nested-a',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'non-nested-packages/b/package.json',
          packageJsonName: '@demo/non-nested-b',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'solo-package/package.json',
          packageJsonName: '@demo/solo',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'solo-package-leading-dot-slash/package.json',
          packageJsonName: '@demo/solo-leading-dot-slash',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'solo-package-leading-double-dot-slash/package.json',
          packageJsonName: '@demo/solo-leading-double-dot-slash',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'solo-package-trailing-slash/package.json',
          packageJsonName: '@demo/solo-trailing-slash',
          pnpmShrinkwrap: undefined as undefined | string,
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(
        packageFiles.every((packageFile) => packageFile.pnpmShrinkwrap)
      ).toBeTrue();
    });

    it('skips when pnpm shrinkwrap file has already been provided', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toEqual([
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
      ]);
    });

    it('filters none matching packages', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        {
          packageFile: 'nested-packages/group/a/package.json',
          packageJsonName: '@demo/nested-group-a',
          pnpmShrinkwrap: undefined as undefined | string,
        },
        {
          packageFile: 'not-matching/b/package.json',
          packageJsonName: '@not-matching/b',
          pnpmShrinkwrap: undefined as undefined | string,
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toEqual([
        {
          packageFile: 'package.json',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        {
          packageFile: 'nested-packages/group/a/package.json',
          packageJsonName: '@demo/nested-group-a',
          pnpmShrinkwrap: 'pnpm-lock.yaml',
        },
        {
          packageFile: 'not-matching/b/package.json',
          packageJsonName: '@not-matching/b',
          pnpmShrinkwrap: undefined,
        },
      ]);
      expect(
        packageFiles.find(
          (packageFile) =>
            packageFile.packageFile === 'not-matching/b/package.json'
        ).pnpmShrinkwrap
      ).toBeUndefined();
    });
  });
});
