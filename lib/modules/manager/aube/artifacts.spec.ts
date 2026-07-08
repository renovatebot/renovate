import _fs from 'fs-extra';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import { exec as _exec } from '../../../util/exec/index.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/exec/index.ts');
vi.mock('fs-extra');

const exec = vi.mocked(_exec);
const fs = vi.mocked(_fs);

const globalConfig: RepoGlobalConfig = {
  localDir: '',
  binarySource: 'global',
};

describe('modules/manager/aube/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [],
      };
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file in config', async () => {
      updateArtifact.updatedDeps = [{}];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'aube-lock.yaml',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
      expect(exec).toHaveBeenCalledWith('aube install --ignore-scripts', {
        cwdFile: 'aube-lock.yaml',
        docker: {},
        toolConstraints: [{ toolName: 'aube' }],
      });
    });

    it('resolves lock file from config when no updated dep carries one', async () => {
      updateArtifact.config.lockFiles = ['aube-lock.yaml'];
      updateArtifact.config.isLockFileMaintenance = true;
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'aube-lock.yaml',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('runs aube install without --ignore-scripts when scripts allowed', async () => {
      GlobalConfig.set({ ...globalConfig, allowScripts: true });
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      await updateArtifacts(updateArtifact);
      expect(exec).toHaveBeenCalledWith('aube install', expect.any(Object));
    });

    it('runs with --ignore-scripts when config.ignoreScripts is set', async () => {
      GlobalConfig.set({ ...globalConfig, allowScripts: true });
      updateArtifact.config.ignoreScripts = true;
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      await updateArtifacts(updateArtifact);
      expect(exec).toHaveBeenCalledWith(
        'aube install --ignore-scripts',
        expect.any(Object),
      );
    });

    it('handles temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('handles full error', async () => {
      const execError = new ExecError('nope', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { fileName: 'aube-lock.yaml', stderr: 'nope' } },
      ]);
    });
  });
});
