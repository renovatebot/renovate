import type { MockedFunction } from 'vitest';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import { exec as _exec } from '../../../util/exec/index.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/exec/index.ts');
vi.mock('../../../util/fs/index.ts');

const exec = vi.mocked(_exec);

// `readLocalFile` is overloaded; `vi.mocked` resolves it to the string (utf8)
// overload, so lockfile reads — which resolve to a Buffer — are set through this
// typed handle rather than an `as never` cast.
const readLockFile = fs.readLocalFile as MockedFunction<
  (fileName: string) => Promise<Buffer | null>
>;

const globalConfig: RepoGlobalConfig = {
  localDir: '',
  binarySource: 'global',
};

describe('modules/manager/nub/artifacts', () => {
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
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      const oldLock = Buffer.from('old');
      readLockFile.mockResolvedValueOnce(oldLock);
      readLockFile.mockResolvedValueOnce(oldLock);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      const oldLock = Buffer.from('old');
      readLockFile.mockResolvedValueOnce(oldLock);
      fs.readLocalFile.mockResolvedValueOnce('# dummy'); // npmrc
      const newLock = Buffer.from('new');
      readLockFile.mockResolvedValueOnce(newLock);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'nub.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('updates lock file when workspace package is updated', async () => {
      updateArtifact.packageFileName = 'packages/workspace-a/package.json';
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      const oldLock = Buffer.from('old');
      readLockFile.mockResolvedValueOnce(oldLock);
      fs.readLocalFile.mockResolvedValueOnce('# dummy'); // npmrc
      const newLock = Buffer.from('new');
      readLockFile.mockResolvedValueOnce(newLock);

      const result = await updateArtifacts(updateArtifact);

      expect(result).toEqual([
        {
          file: {
            path: 'nub.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);

      expect(exec).toHaveBeenCalledWith(
        'nub install --lockfile-only --no-frozen-lockfile --ignore-scripts',
        {
          cwdFile: 'nub.lock',
          docker: {},
          toolConstraints: [
            {
              toolName: 'nub',
            },
          ],
        },
      );
    });

    it('supports lockFileMaintenance', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      updateArtifact.config.isLockFileMaintenance = true;
      const oldLock = Buffer.from('old');
      readLockFile.mockResolvedValueOnce(oldLock);
      fs.readLocalFile.mockResolvedValueOnce('# dummy'); // npmrc
      const newLock = Buffer.from('new');
      readLockFile.mockResolvedValueOnce(newLock);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'nub.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('supports lockFileMaintenance (without updated deps)', async () => {
      updateArtifact.config.lockFiles = ['nub.lock'];
      updateArtifact.config.isLockFileMaintenance = true;
      const oldLock = Buffer.from('old');
      readLockFile.mockResolvedValueOnce(oldLock);
      fs.readLocalFile.mockResolvedValueOnce('# dummy'); // npmrc
      const newLock = Buffer.from('new');
      readLockFile.mockResolvedValueOnce(newLock);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'nub.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('handles temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: {},
      });
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      readLockFile.mockResolvedValueOnce(Buffer.from('old'));
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
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      readLockFile.mockResolvedValueOnce(Buffer.from('old'));
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { fileName: 'nub.lock', stderr: 'nope' } },
      ]);
    });
  });

  describe('nub command execution', () => {
    it.each([
      {
        allowScripts: undefined,
        ignoreScripts: undefined,
        expectedCmd:
          'nub install --lockfile-only --no-frozen-lockfile --ignore-scripts',
      },
      {
        allowScripts: false,
        ignoreScripts: undefined,
        expectedCmd:
          'nub install --lockfile-only --no-frozen-lockfile --ignore-scripts',
      },
      {
        allowScripts: true,
        ignoreScripts: undefined,
        expectedCmd: 'nub install --lockfile-only --no-frozen-lockfile',
      },
      {
        allowScripts: true,
        ignoreScripts: true,
        expectedCmd:
          'nub install --lockfile-only --no-frozen-lockfile --ignore-scripts',
      },
      {
        allowScripts: true,
        ignoreScripts: false,
        expectedCmd: 'nub install --lockfile-only --no-frozen-lockfile',
      },
    ])(
      'omits --ignore-scripts only when scripts are explicitly allowed (allowScripts=$allowScripts, ignoreScripts=$ignoreScripts)',
      async ({ allowScripts, ignoreScripts, expectedCmd }) => {
        GlobalConfig.set({ ...globalConfig, allowScripts });
        const updateArtifact: UpdateArtifact = {
          config: { ignoreScripts },
          newPackageFileContent: '',
          packageFileName: '',
          updatedDeps: [{ manager: 'nub', lockFiles: ['nub.lock'] }],
        };

        readLockFile.mockResolvedValueOnce(Buffer.from('old'));
        readLockFile.mockResolvedValueOnce(Buffer.from('new'));

        await updateArtifacts(updateArtifact);

        expect(exec).toHaveBeenCalledExactlyOnceWith(expectedCmd, {
          cwdFile: 'nub.lock',
          docker: {},
          toolConstraints: [
            {
              toolName: 'nub',
            },
          ],
        });
      },
    );

    it('passes --no-frozen-lockfile so nub re-resolves the bumped manifest under a CI-frozen default', async () => {
      GlobalConfig.set(globalConfig);
      const updateArtifact: UpdateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [{ manager: 'nub', lockFiles: ['nub.lock'] }],
      };
      readLockFile.mockResolvedValueOnce(Buffer.from('old'));
      readLockFile.mockResolvedValueOnce(Buffer.from('new'));

      await updateArtifacts(updateArtifact);

      expect(exec).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('--no-frozen-lockfile'),
        expect.anything(),
      );
    });
  });
});
