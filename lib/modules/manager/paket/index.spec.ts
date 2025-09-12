import { beforeEach, describe } from 'vitest';
import { NugetDatasource } from '../../datasource/nuget';
import type {
  ExtractConfig,
  UpdateArtifact,
  UpdateLockedConfig,
} from '../types';
import * as tool from './tool';
import {
  extractPackageFile,
  updateArtifacts,
  updateLockedDependency,
} from './index';
import { fs, git } from '~test/util';

describe('modules/manager/paket/index', () => {
  const packageFileName = '/app/test/paket.dependencies';

  beforeEach(() => {
    vi.mock('../../../util/fs');
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) => {
        expect(fileName).equals(packageFileName);
        expect(siblingName).equals('paket.lock');
        return '/app/test/paket.lock';
      },
    );
  });

  describe('extractPackageFile()', () => {
    const config: ExtractConfig = {};
    const packageFileContent = 'Fake package content';

    it('return all packages', async () => {
      const spy = vi.spyOn(tool, 'getAllPackages');
      spy.mockResolvedValue([
        { name: 'FSharp.Core', version: '1.2.3', group: 'Main' },
        { name: 'XUnit', version: '2.5.0', group: 'Main' },
      ]);

      const result = await extractPackageFile(
        packageFileContent,
        packageFileName,
        config,
      );

      expect(result).toEqual({
        deps: [
          {
            depType: 'dependencies',
            depName: 'FSharp.Core',
            packageName: 'FSharp.Core',
            currentVersion: '1.2.3',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '1.2.3',
          },
          {
            depType: 'dependencies',
            depName: 'XUnit',
            packageName: 'XUnit',
            currentVersion: '2.5.0',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '2.5.0',
          },
        ],
        lockFiles: ['/app/test/paket.lock'],
      });
    });
  });

  describe('updateArtifacts()', () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      packageFileName,
      newPackageFileContent: 'Fake package content',
      updatedDeps: [],
    };
    const lockFileName = '/app/test/paket.lock';

    it('update all packages', async () => {
      const toolSpy = vi.spyOn(tool, 'updateAllPackages');
      toolSpy.mockResolvedValue();

      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: 'Old fake lock file content',
      });
      const newContentLockFile = 'New fake lock file content';
      fs.getLocalFiles.mockResolvedValueOnce({
        [lockFileName]: newContentLockFile,
      });

      const result = await updateArtifacts(updateArtifact);

      expect(toolSpy.mock.calls).toEqual([[lockFileName]]);
      expect(result).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newContentLockFile,
          },
        },
      ]);
    });

    it('return null if no changes', async () => {
      const toolSpy = vi.spyOn(tool, 'updateAllPackages');
      toolSpy.mockResolvedValue();

      const contentLockFile = 'Fake lock file content';
      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: contentLockFile,
      });
      fs.getLocalFiles.mockResolvedValueOnce({
        [lockFileName]: contentLockFile,
      });

      const result = await updateArtifacts(updateArtifact);

      expect(result).toBeNull();
    });
  });

  describe('updateLockedDependency()', () => {
    const lockFileName = '/app/test/paket.lock';
    const config: UpdateLockedConfig = {
      packageFile: packageFileName,
      lockFile: lockFileName,
      depName: 'FSharp.Core',
      currentVersion: '1.2.3',
      newVersion: '1.2.4',
    };

    it('update all packages', async () => {
      const toolSpy = vi.spyOn(tool, 'updatePackage');
      toolSpy.mockResolvedValue();

      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: 'Old fake lock file content',
      });
      const newContentLockFile = 'New fake lock file content';
      fs.getLocalFiles.mockResolvedValueOnce({
        [lockFileName]: newContentLockFile,
      });

      const result = await updateLockedDependency(config);

      expect(toolSpy.mock.calls).toEqual([
        [
          {
            filePath: lockFileName,
            packageName: config.depName,
            version: config.newVersion,
          },
        ],
      ]);
      expect(result).toEqual({
        files: { [lockFileName]: newContentLockFile },
        status: 'updated',
      });
    });

    it('return null if no changes', async () => {
      const toolSpy = vi.spyOn(tool, 'updatePackage');
      toolSpy.mockResolvedValue();

      const contentLockFile = 'Fake lock file content';
      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: contentLockFile,
      });
      fs.getLocalFiles.mockResolvedValueOnce({
        [lockFileName]: contentLockFile,
      });

      const result = await updateLockedDependency(config);

      expect(result).toEqual({ status: 'already-updated' });
    });
  });
});
