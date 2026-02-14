import { beforeEach, describe } from 'vitest';
import { fs, git } from '~test/util.ts';
import type { UpdateLockedConfig } from '../types.ts';
import * as tool from './tool.ts';
import { updateLockedDependency } from './update-lock.ts';

describe('modules/manager/paket/update-lock', () => {
  const packageFileName = '/app/test/paket.dependencies';

  function initializeMock() {
    vi.mock('../../../util/fs');
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) => {
        expect(fileName).equals(packageFileName);
        expect(siblingName).equals('paket.lock');
        return '/app/test/paket.lock';
      },
    );
  }
  beforeEach(() => {
    initializeMock();
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
