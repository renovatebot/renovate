import { exec, mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

describe('modules/manager/rebar/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '/fake/test/pkg/dir/rebar.config',
        updatedDeps: [],
      };
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file is found', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('old');
      const execSnapshots = mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toBeNull();
      expect(execSnapshots).toBeArrayOfSize(1);
      expect(execSnapshots[0].cmd).toEqual('rebar3 upgrade');
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar', depName: 'cowboy' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'rebar.lock',
            type: 'addition',
            contents: 'new',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(1);
      expect(execSnapshots[0].cmd).toEqual('rebar3 upgrade cowboy');
    });

    it('supports lockFileMaintenance', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      updateArtifact.config.isLockFileMaintenance = true;
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'rebar.lock',
            type: 'addition',
            contents: 'new',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(1);
      expect(execSnapshots[0].cmd).toEqual('rebar3 upgrade --all');
    });

    it('handles temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      exec.mockRejectedValueOnce(execError);
      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('handles full error', async () => {
      const execError = new ExecError('fake_rebar3_failure', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          artifactError: {
            fileName: 'rebar.lock',
            stderr: 'fake_rebar3_failure',
          },
        },
      ]);
    });

    it('prevents injections', async () => {
      updateArtifact.updatedDeps = [{ depName: '|| date' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();
      await updateArtifacts(updateArtifact);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `rebar3 upgrade '|| date'`,
        },
      ]);
    });

    it('uses parent lock file when sibling not found', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar', depName: 'cowboy' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('parent/rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.readLocalFile.mockResolvedValueOnce('new');
      const execSnapshots = mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'parent/rebar.lock',
            type: 'addition',
            contents: 'new',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(1);
    });

    it('returns null for lockFileMaintenance without lock file', async () => {
      updateArtifact.config.isLockFileMaintenance = true;
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns error if rebar.config write fails', async () => {
      updateArtifact.updatedDeps = [{ manager: 'rebar' }];
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce('old');
      fs.writeLocalFile.mockRejectedValueOnce(new Error('write failed'));
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          artifactError: {
            fileName: 'rebar.lock',
            stderr: 'write failed',
          },
        },
      ]);
    });
  });
});
