import { fs } from '~test/util.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import * as tool from './tool.ts';
import type { PaketManagerData } from './types.ts';

vi.mock('../../../util/fs/index.ts');

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
    const updateArtifact: UpdateArtifact<PaketManagerData> = {
      config: {},
      packageFileName,
      newPackageFileContent: 'Fake package content',
      updatedDeps: [
        {
          depName: 'xunit',
          newVersion: '2.9.3',
          managerData: { group: 'Main' },
        },
      ],
    };
    const lockFileName = '/app/test/paket.lock';
    const toolConstraints = [
      { toolName: 'dotnet', constraint: undefined },
      { toolName: 'paket', constraint: undefined },
    ];

    function mockLockFileChangedByTool(
      toolSpy: ReturnType<typeof vi.spyOn>,
      newContentLockFile: string,
    ): void {
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);

          if (toolSpy.mock.calls.length === 0) {
            return Promise.resolve('Old fake lock file content');
          } else {
            return Promise.resolve(newContentLockFile);
          }
        },
      );
    }

    it('updates the given package only', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      const newContentLockFile = 'New fake lock file content';
      mockLockFileChangedByTool(toolSpy, newContentLockFile);

      const result = await updateArtifacts(updateArtifact);

      expect(fs.readLocalFile).toHaveBeenCalledWith(lockFileName, 'utf8');
      expect(toolSpy).toHaveBeenCalledExactlyOnceWith(
        lockFileName,
        [{ packageName: 'xunit', version: '2.9.3', group: 'Main' }],
        toolConstraints,
      );
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

    it('updates each updated package in a single tool call', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      mockLockFileChangedByTool(toolSpy, 'New fake lock file content');

      const result = await updateArtifacts({
        ...updateArtifact,
        updatedDeps: [
          {
            depName: 'xunit',
            newVersion: '2.9.3',
            managerData: { group: 'Main' },
          },
          {
            depName: 'Fake',
            newVersion: '5.16',
            managerData: { group: 'GroupA' },
          },
        ],
      });

      expect(toolSpy).toHaveBeenCalledExactlyOnceWith(
        lockFileName,
        [
          { packageName: 'xunit', version: '2.9.3', group: 'Main' },
          { packageName: 'Fake', version: '5.16', group: 'GroupA' },
        ],
        toolConstraints,
      );
      expect(result).toBeArrayOfSize(1);
    });

    it('updates all packages if a dep is missing newVersion', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      mockLockFileChangedByTool(toolSpy, 'New fake lock file content');

      const result = await updateArtifacts({
        ...updateArtifact,
        updatedDeps: [
          {
            depName: 'xunit',
            newVersion: '2.9.3',
            managerData: { group: 'Main' },
          },
          { depName: 'Fake' },
        ],
      });

      expect(toolSpy).toHaveBeenCalledExactlyOnceWith(
        lockFileName,
        [{}],
        toolConstraints,
      );
      expect(result).toBeArrayOfSize(1);
    });

    it('updates all packages if a dep is missing depName', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      mockLockFileChangedByTool(toolSpy, 'New fake lock file content');

      const result = await updateArtifacts({
        ...updateArtifact,
        updatedDeps: [{ newVersion: '5.16', managerData: { group: 'Main' } }],
      });

      expect(toolSpy).toHaveBeenCalledExactlyOnceWith(
        lockFileName,
        [{}],
        toolConstraints,
      );
      expect(result).toBeArrayOfSize(1);
    });

    it('updates all packages during lock file maintenance', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      mockLockFileChangedByTool(toolSpy, 'New fake lock file content');

      const result = await updateArtifacts({
        ...updateArtifact,
        config: { isLockFileMaintenance: true },
        updatedDeps: [],
      });

      expect(toolSpy).toHaveBeenCalledExactlyOnceWith(
        lockFileName,
        [{}],
        toolConstraints,
      );
      expect(result).toBeArrayOfSize(1);
    });

    it('return null if no updated deps', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateArtifacts({
        ...updateArtifact,
        updatedDeps: [],
      });

      expect(toolSpy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('return null if no changes', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockResolvedValue();
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateArtifacts(updateArtifact);

      expect(fs.readLocalFile).toHaveBeenCalledWith(lockFileName, 'utf8');
      expect(result).toBeNull();
    });

    it('return artifact error if cmd failed', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockRejectedValue(new Error('Cmd error'));
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      const result = await updateArtifacts(updateArtifact);

      expect(result).toEqual([
        {
          artifactError: {
            fileName: lockFileName,
            stderr: 'Cmd error',
          },
        },
      ]);
    });

    it('rethrow temporary error', async () => {
      const toolSpy = vi.spyOn(tool, 'runPaketUpdate');
      toolSpy.mockRejectedValue(new Error(TEMPORARY_ERROR));
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve('Old fake lock file content');
        },
      );

      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });
  });
});
