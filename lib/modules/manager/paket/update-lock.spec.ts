import { beforeEach, describe } from 'vitest';
import { fs } from '~test/util.ts';
import type { UpdateLockedConfig } from '../types.ts';
import * as tool from './tool.ts';
import { updateLockedDependency } from './update-lock.ts';

vi.mock('../../../util/fs');

describe('modules/manager/paket/update-lock', () => {
  const packageFileName = '/app/test/paket.dependencies';

  function initializeMock() {
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
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();

      const newContentLockFile = 'New fake lock file content';
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).equals(lockFileName);

          if (toolSpy.mock.calls.length === 0) {
            return Promise.resolve('Old fake lock file content');
          } else {
            return Promise.resolve(newContentLockFile);
          }
        },
      );

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
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).equals(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateLockedDependency(config);

      expect(result).toEqual({ status: 'already-updated' });
    });
  });
});
