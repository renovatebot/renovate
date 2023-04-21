import yaml from 'js-yaml';
import { getFixturePath, logger } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import * as fs from '../../../../util/fs';
import {
  detectPnpmWorkspaces,
  extractPnpmFilters,
  findPnpmWorkspace,
} from './pnpm';

describe('modules/manager/npm/extract/pnpm', () => {
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
      expect(res).toBeUndefined();
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
      expect(res).toBeUndefined();
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
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
        {
          packageFile: 'nested-packages/group/a/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/nested-group-a',
          },
        },
        {
          packageFile: 'nested-packages/group/b/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/nested-group-b',
          },
        },
        {
          packageFile: 'non-nested-packages/a/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/non-nested-a',
          },
        },
        {
          packageFile: 'non-nested-packages/b/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/non-nested-b',
          },
        },
        {
          packageFile: 'solo-package/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/solo',
          },
        },
        {
          packageFile: 'solo-package-leading-dot-slash/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/solo-leading-dot-slash',
          },
        },
        {
          packageFile: 'solo-package-leading-double-dot-slash/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/solo-leading-double-dot-slash',
          },
        },
        {
          packageFile: 'solo-package-trailing-slash/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/solo-trailing-slash',
          },
        },
        {
          packageFile: 'test/test-package/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/test-package',
          },
        },
        {
          packageFile: 'tests/test-package2/package.json',
          managerData: {
            pnpmShrinkwrap: undefined as undefined | string,
            packageJsonName: '@demo/test-package2',
          },
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(
        packageFiles.every(
          (packageFile) => packageFile.managerData.pnpmShrinkwrap
        )
      ).toBeTrue();
    });

    it('skips when pnpm shrinkwrap file has already been provided', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toEqual([
        {
          packageFile: 'package.json',
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
      ]);
    });

    it('filters none matching packages', async () => {
      const packageFiles = [
        {
          packageFile: 'package.json',
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
        {
          packageFile: 'nested-packages/group/a/package.json',
          packageJsonName: '@demo/nested-group-a',
          managerData: { pnpmShrinkwrap: undefined as undefined | string },
        },
        {
          packageFile: 'not-matching/b/package.json',
          packageJsonName: '@not-matching/b',
          managerData: { pnpmShrinkwrap: undefined as undefined | string },
        },
      ];

      await detectPnpmWorkspaces(packageFiles);
      expect(packageFiles).toEqual([
        {
          packageFile: 'package.json',
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
        {
          packageFile: 'nested-packages/group/a/package.json',
          packageJsonName: '@demo/nested-group-a',
          managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
        },
        {
          packageFile: 'not-matching/b/package.json',
          packageJsonName: '@not-matching/b',
          managerData: { pnpmShrinkwrap: undefined },
        },
      ]);
      expect(
        packageFiles.find(
          (packageFile) =>
            packageFile.packageFile === 'not-matching/b/package.json'
        )?.managerData.pnpmShrinkwrap
      ).toBeUndefined();
    });
  });
});
