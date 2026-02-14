import { beforeEach, describe } from 'vitest';
import { fs, git } from '~test/util.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import * as tool from './tool.ts';

describe('modules/manager/paket/artifacts', () => {
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

  describe('updateArtifacts()', () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      packageFileName,
      newPackageFileContent: 'Fake package content',
      updatedDeps: [],
    };
    const lockFileName = '/app/test/paket.lock';

    it('update all packages', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();

      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: 'Old fake lock file content',
      });
      const newContentLockFile = 'New fake lock file content';
      fs.getLocalFiles.mockResolvedValueOnce({
        [lockFileName]: newContentLockFile,
      });

      const result = await updateArtifacts(updateArtifact);

      expect(toolSpy.mock.calls).toEqual([[{ filePath: lockFileName }]]);
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
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
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
});
