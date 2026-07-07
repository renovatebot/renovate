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
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      // npmrc
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
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
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);

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
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      // npmrc
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
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
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      // npmrc
      fs.readFile.mockResolvedValueOnce('# dummy' as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
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
        { manager: 'nub', lockFiles: ['nub.lock'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { fileName: 'nub.lock', stderr: 'nope' } },
      ]);
    });
  });

  describe('nub command execution', () => {
    it('omits --ignore-scripts only when scripts are explicitly allowed', async () => {
      const testCases = [
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
      ];

      for (const testCase of testCases) {
        GlobalConfig.set({
          ...globalConfig,
          allowScripts: testCase.allowScripts,
        });
        const updateArtifact: UpdateArtifact = {
          config: { ignoreScripts: testCase.ignoreScripts },
          newPackageFileContent: '',
          packageFileName: '',
          updatedDeps: [{ manager: 'nub', lockFiles: ['nub.lock'] }],
        };

        const oldLock = Buffer.from('old');
        fs.readFile.mockResolvedValueOnce(oldLock as never);
        const newLock = Buffer.from('new');
        fs.readFile.mockResolvedValueOnce(newLock as never);

        await updateArtifacts(updateArtifact);

        expect(exec).toHaveBeenCalledExactlyOnceWith(testCase.expectedCmd, {
          cwdFile: 'nub.lock',
          docker: {},
          toolConstraints: [
            {
              toolName: 'nub',
            },
          ],
        });

        exec.mockClear();
        GlobalConfig.reset();
      }
    });

    it('passes --no-frozen-lockfile so nub re-resolves the bumped manifest under a CI-frozen default', async () => {
      GlobalConfig.set(globalConfig);
      const updateArtifact: UpdateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [{ manager: 'nub', lockFiles: ['nub.lock'] }],
      };
      fs.readFile.mockResolvedValueOnce(Buffer.from('old') as never);
      fs.readFile.mockResolvedValueOnce(Buffer.from('new') as never);

      await updateArtifacts(updateArtifact);

      expect(exec).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('--no-frozen-lockfile'),
        expect.anything(),
      );
      GlobalConfig.reset();
    });
  });
});
