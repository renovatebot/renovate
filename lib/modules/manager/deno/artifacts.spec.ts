import _fs from 'fs-extra';
import type { DirectoryResult } from 'tmp-promise';
import tmp from 'tmp-promise';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { exec as _exec } from '../../../util/exec';
import { ExecError } from '../../../util/exec/exec-error';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';

vi.mock('../../../util/exec');
vi.mock('fs-extra');

const exec = vi.mocked(_exec);
const fs = vi.mocked(_fs);

const updateArtifact: UpdateArtifact = {
  config: {
    constraints: { deno: '2.4.5' },
  },
  newPackageFileContent: '',
  packageFileName: '',
  updatedDeps: [],
};

describe('modules/manager/deno/artifacts', () => {
  describe('updateArtifacts()', () => {
    let localDirResult: DirectoryResult;
    let localDir: string;

    beforeEach(async () => {
      localDirResult = await tmp.dir({ unsafeCleanup: true });
      localDir = localDirResult.path;

      GlobalConfig.set({ localDir });
    });

    afterEach(async () => {
      await localDirResult?.cleanup();
    });

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file in config', async () => {
      updateArtifact.updatedDeps = [{}];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips and returns an error if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          artifactError: {
            lockFile: 'deno.lock',
            stderr: `Failed to read "deno.lock"`,
          },
        },
      ]);
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'deno.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('change directory if import map is used', async () => {
      updateArtifact.updatedDeps = [
        {
          manager: 'deno',
          lockFiles: ['sub/deno.lock'],
          packageFile: 'import_map.json',
          managerData: { importMapReferrer: 'sub/deno.json' },
        },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'sub/deno.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
    });

    it('supports lockFileMaintenance', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      updateArtifact.config.updateType = 'lockFileMaintenance';
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      const newLock = Buffer.from('new');
      fs.readFile.mockResolvedValueOnce(newLock as never);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'deno.lock',
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
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
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
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { lockFile: 'deno.lock', stderr: 'nope' } },
      ]);
    });
  });

  it('depType tasks returns an error', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [
        { lockFiles: ['deno.lock'], depType: 'tasks', depName: 'dep1' },
      ],
    };
    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        artifactError: {
          lockFile: 'deno.lock',
          stderr: `depType: "tasks", depName: "dep1" can't be updated with a lock file: "deno.lock"`,
        },
      },
    ]);
  });

  it('depType tasks.command returns an error', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [
        { lockFiles: ['deno.lock'], depType: 'tasks.command', depName: 'dep1' },
      ],
    };
    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        artifactError: {
          lockFile: 'deno.lock',
          stderr: `depType: "tasks.command", depName: "dep1" can't be updated with a lock file: "deno.lock"`,
        },
      },
    ]);
  });

  it('supports lockFileMaintenance (without updated deps)', async () => {
    updateArtifact.updatedDeps = [];
    updateArtifact.config.lockFiles = ['deno.lock'];
    updateArtifact.config.isLockFileMaintenance = true;
    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);
    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        file: {
          path: 'deno.lock',
          type: 'addition',
          contents: newLock,
        },
      },
    ]);
  });

  it('deno command execution', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [{ lockFiles: ['deno.lock'] }],
    };

    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    await updateArtifacts(updateArtifact);

    expect(exec).toHaveBeenCalledExactlyOnceWith('deno install', {
      cwdFile: '',
      docker: {},
      toolConstraints: [
        {
          toolName: 'deno',
        },
      ],
      userConfiguredEnv: undefined,
    });
  });
});
