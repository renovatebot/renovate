import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { exec } from '../../../util/exec';
import { ExecError } from '../../../util/exec/exec-error';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from '.';
import { fs } from '~test/util';

vi.mock('../../../util/exec');
vi.mock('../../../util/fs');

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

describe('modules/manager/gleam/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '/fake/test/pkg/dir/gleam.toml',
        updatedDeps: [],
      };
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file is found', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if cannot read new lock file', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('old');
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'manifest.toml',
            type: 'addition',
            contents: 'new',
          },
        },
      ]);
    });

    it('supports lockFileMaintenance', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      updateArtifact.config.isLockFileMaintenance = true;
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'manifest.toml',
            type: 'addition',
            contents: 'new',
          },
        },
      ]);
    });

    it('returns null if lockfile content unchanged', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      updateArtifact.config.isLockFileMaintenance = true;
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('handles temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      vi.mocked(exec).mockRejectedValueOnce(execError);
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('handles temporary error when reading the lock file', async () => {
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      fs.readLocalFile.mockImplementationOnce(() => {
        throw new Error(TEMPORARY_ERROR);
      });
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('handles full error', async () => {
      const execError = new ExecError('fake_gleam_failure', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [{ manager: 'gleam' }];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock.toString());
      vi.mocked(exec).mockRejectedValueOnce(execError);
      fs.getSiblingFileName.mockReturnValueOnce('manifest.toml');
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          artifactError: {
            lockFile: 'manifest.toml',
            stderr: 'fake_gleam_failure',
          },
        },
      ]);
    });
  });
});
