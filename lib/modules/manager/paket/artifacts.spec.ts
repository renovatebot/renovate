import { beforeEach, describe } from 'vitest';
import { fs } from '~test/util.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import * as tool from './tool.ts';

vi.mock('../../../util/fs');

describe('modules/manager/paket/artifacts', () => {
  const packageFileName = '/app/test/paket.dependencies';

  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) => {
        if (fileName !== packageFileName) {
          throw new Error(`Not expected fileName: ${fileName}`);
        }
        if (siblingName !== 'paket.lock') {
          throw new Error(`Not expected siblingName: ${siblingName}`);
        }
        return '/app/test/paket.lock';
      },
    );
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
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).equals(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateArtifacts(updateArtifact);

      expect(result).toBeNull();
    });

    it('return artefact error if cmd failed', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockRejectedValue(new Error('Cmd error'));
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).equals(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateArtifacts(updateArtifact);

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: 'Cmd error',
          },
        },
      ]);
    });
  });
});
