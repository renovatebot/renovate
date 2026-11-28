import { exec, mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const globalConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: '',
  binarySource: 'global',
};

describe('modules/manager/nimble/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: 'requires "typestates >= 0.14.1"',
        packageFileName: '/fake/test/pkg/dir/lockfreequeues.nimble',
        updatedDeps: [],
      };
      fs.getSiblingFileName.mockImplementation(
        (_pkg: string, sibling: string) => sibling,
      );
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('skips if neither nimble.lock nor atlas.lock is found', async () => {
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(null);
      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
    });

    it('updates nimble.lock via mise exec nimble lock -y', async () => {
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce('old-nimble-lock') // nimble.lock check
        .mockResolvedValueOnce(null) // atlas.lock check
        .mockResolvedValueOnce('new-nimble-lock'); // read updated nimble.lock
      const execSnapshots = mockExecAll();

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            path: 'nimble.lock',
            type: 'addition',
            contents: 'new-nimble-lock',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(1);
      expect(execSnapshots[0].cmd).toEqual(
        'mise exec --yes nim@latest -- nimble lock -y',
      );
    });

    it('returns null when nimble.lock content is unchanged', async () => {
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce('same-nimble-lock')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('same-nimble-lock');
      const execSnapshots = mockExecAll();

      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
      expect(execSnapshots).toBeArrayOfSize(1);
    });

    it('updates atlas.lock via mise exec atlas install && atlas pin', async () => {
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce(null) // nimble.lock check
        .mockResolvedValueOnce('old-atlas-lock') // atlas.lock check
        .mockResolvedValueOnce('new-atlas-lock'); // read updated atlas.lock
      const execSnapshots = mockExecAll();

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            path: 'atlas.lock',
            type: 'addition',
            contents: 'new-atlas-lock',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(2);
      expect(execSnapshots[0].cmd).toEqual(
        'mise exec --yes nim@latest -- atlas install',
      );
      expect(execSnapshots[1].cmd).toEqual(
        'mise exec --yes nim@latest -- atlas pin',
      );
    });

    it('returns null when atlas.lock content is unchanged', async () => {
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('same-atlas-lock')
        .mockResolvedValueOnce('same-atlas-lock');
      const execSnapshots = mockExecAll();

      await expect(updateArtifacts(updateArtifact)).resolves.toBeNull();
      expect(execSnapshots).toBeArrayOfSize(2);
    });

    it('supports lockFileMaintenance for both nimble.lock and atlas.lock', async () => {
      updateArtifact.config.isLockFileMaintenance = true;
      fs.readLocalFile
        .mockResolvedValueOnce('old-nimble-lock')
        .mockResolvedValueOnce('old-atlas-lock')
        .mockResolvedValueOnce('new-nimble-lock')
        .mockResolvedValueOnce('new-atlas-lock');
      const execSnapshots = mockExecAll();

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          file: {
            path: 'nimble.lock',
            type: 'addition',
            contents: 'new-nimble-lock',
          },
        },
        {
          file: {
            path: 'atlas.lock',
            type: 'addition',
            contents: 'new-atlas-lock',
          },
        },
      ]);
      expect(execSnapshots).toBeArrayOfSize(3);
    });

    it('rethrows TEMPORARY_ERROR when updating nimble.lock', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce('old-nimble-lock')
        .mockResolvedValueOnce(null);
      exec.mockRejectedValueOnce(execError);

      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('returns artifactError when nimble.lock update fails', async () => {
      const execError = new ExecError('nimble_lock_failed', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce('old-nimble-lock')
        .mockResolvedValueOnce(null);
      exec.mockRejectedValueOnce(execError);

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          artifactError: {
            fileName: 'nimble.lock',
            stderr: 'nimble_lock_failed',
          },
        },
      ]);
    });

    it('rethrows TEMPORARY_ERROR when updating atlas.lock', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('old-atlas-lock');
      exec.mockRejectedValueOnce(execError);

      await expect(updateArtifacts(updateArtifact)).rejects.toThrow(
        TEMPORARY_ERROR,
      );
    });

    it('returns artifactError when atlas.lock update fails', async () => {
      const execError = new ExecError('atlas_pin_failed', {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('old-atlas-lock');
      exec.mockRejectedValueOnce(execError);

      await expect(updateArtifacts(updateArtifact)).resolves.toEqual([
        {
          artifactError: {
            fileName: 'atlas.lock',
            stderr: 'atlas_pin_failed',
          },
        },
      ]);
    });

    it('installs mise via containerbase when binarySource=install', async () => {
      vi.stubEnv('CONTAINERBASE', 'true');
      GlobalConfig.set({ ...globalConfig, binarySource: 'install' });
      updateArtifact.updatedDeps = [{ manager: 'nimble' }];
      updateArtifact.config.extractedConstraints = { mise: '2026.1.0' };
      fs.readLocalFile
        .mockResolvedValueOnce('old-nimble-lock')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('new-nimble-lock');
      const execSnapshots = mockExecAll();

      await updateArtifacts(updateArtifact);

      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool mise 2026.1.0' },
        { cmd: 'mise exec --yes nim@latest -- nimble lock -y' },
      ]);
    });
  });
});
