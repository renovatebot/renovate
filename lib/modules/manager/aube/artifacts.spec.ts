import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import { exec as _exec } from '../../../util/exec/index.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/exec/index.ts');
vi.mock('../../../util/fs/index.ts');

const exec = vi.mocked(_exec);

const globalConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
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
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('skips if no lock file in config', async () => {
      updateArtifact.updatedDeps = [{}];
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('skips if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      fs.readLocalFile.mockResolvedValueOnce('# dummy');
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            path: 'aube-lock.yaml',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
      expect(exec).toHaveBeenCalledWith(
        'aube install --lockfile-only --prefer-frozen-lockfile --ignore-scripts',
        {
          cwdFile: 'aube-lock.yaml',
          docker: {},
          toolConstraints: [{ toolName: 'aube' }],
        },
      );
    });

    it('resolves lock file from config when no updated dep carries one', async () => {
      updateArtifact.config.lockFiles = ['aube-lock.yaml'];
      updateArtifact.config.isLockFileMaintenance = true;
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      fs.readLocalFile.mockResolvedValueOnce('# dummy');
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            path: 'aube-lock.yaml',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
      expect(fs.deleteLocalFile).toHaveBeenCalledWith('aube-lock.yaml');
    });

    it('runs aube install without --ignore-scripts when scripts allowed', async () => {
      GlobalConfig.set({ ...globalConfig, allowScripts: true });
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      fs.readLocalFile.mockResolvedValueOnce('# dummy');
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      await updateArtifacts(updateArtifact);
      expect(exec).toHaveBeenCalledWith(
        'aube install --lockfile-only --prefer-frozen-lockfile',
        expect.any(Object),
      );
    });

    it('runs with --ignore-scripts when config.ignoreScripts is set', async () => {
      GlobalConfig.set({ ...globalConfig, allowScripts: true });
      updateArtifact.config.ignoreScripts = true;
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      fs.readLocalFile.mockResolvedValueOnce('# dummy');
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      await updateArtifacts(updateArtifact);
      expect(exec).toHaveBeenCalledWith(
        'aube install --lockfile-only --prefer-frozen-lockfile --ignore-scripts',
        expect.any(Object),
      );
    });

    it('installs the aube version extracted from the package file', async () => {
      updateArtifact.config.extractedConstraints = { aube: '2.9.0' };
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      fs.readLocalFile.mockResolvedValueOnce(Buffer.from('old') as never);
      await updateArtifacts(updateArtifact);
      expect(exec).toHaveBeenCalledWith(
        'aube install --lockfile-only --prefer-frozen-lockfile --ignore-scripts',
        expect.objectContaining({
          toolConstraints: [{ toolName: 'aube', constraint: '2.9.0' }],
        }),
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        { artifactError: { fileName: 'aube-lock.yaml', stderr: 'nope' } },
      ]);
    });

    it('restores .npmrc when the install fails', async () => {
      const execError = new ExecError('nope', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [
        { manager: 'aube', lockFiles: ['aube-lock.yaml'] },
      ];
      fs.readLocalFile.mockResolvedValueOnce(Buffer.from('old') as never);
      // npmrc
      fs.readLocalFile.mockResolvedValueOnce('# dummy');
      exec.mockRejectedValueOnce(execError);

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        { artifactError: { fileName: 'aube-lock.yaml', stderr: 'nope' } },
      ]);

      expect(fs.writeLocalFile).toHaveBeenCalledWith('.npmrc', '# dummy');
    });
  });
});
