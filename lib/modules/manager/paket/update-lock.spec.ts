import { fs } from '~test/util.ts';
import type { UpdateLockedConfig } from '../types.ts';
import * as tool from './tool.ts';
import { updateLockedDependency } from './update-lock.ts';

vi.mock('../../../util/fs');

describe('modules/manager/paket/update-lock', () => {
  const packageFileName = '/app/test/paket.dependencies';

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

      expect(toolSpy).toHaveBeenCalledWith({
        filePath: lockFileName,
        packageName: config.depName,
        version: config.newVersion,
        toolConstraints: [{ toolName: 'dotnet' }, { toolName: 'paket' }],
      });
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
