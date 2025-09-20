import _fs from 'fs-extra';
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
    beforeEach(() => {
      GlobalConfig.set({
        localDir: '',
      });
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
        { manager: 'deno', lockFiles: ['deno.lock'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'deno', lockFiles: ['deno.lock'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'deno', lockFiles: ['deno.lock'] },
      ];
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
      updateArtifact.updatedDeps = [
        { manager: 'deno', lockFiles: ['deno.lock'] },
      ];
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
      updateArtifact.updatedDeps = [
        { manager: 'deno', lockFiles: ['deno.lock'] },
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
        options: { encoding: 'utf8' },
      });
      updateArtifact.updatedDeps = [
        { manager: 'deno', lockFiles: ['deno.lock'] },
      ];
      const oldLock = Buffer.from('old');
      fs.readFile.mockResolvedValueOnce(oldLock as never);
      exec.mockRejectedValueOnce(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { lockFile: 'deno.lock', stderr: 'nope' } },
      ]);
    });
  });

  it('depType tasks returns null', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [
        { manager: 'deno', lockFiles: ['deno.lock'], depType: 'tasks' },
      ],
    };
    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toBeNull();
  });

  it('depType tasks.command returns null', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [
        { manager: 'deno', lockFiles: ['deno.lock'], depType: 'tasks.command' },
      ],
    };
    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toBeNull();
  });

  it('deno command execution', async () => {
    const updateArtifact: UpdateArtifact = {
      config: {},
      newPackageFileContent: '',
      packageFileName: '',
      updatedDeps: [{ manager: 'deno', lockFiles: ['deno.lock'] }],
    };

    const oldLock = Buffer.from('old');
    fs.readFile.mockResolvedValueOnce(oldLock as never);
    const newLock = Buffer.from('new');
    fs.readFile.mockResolvedValueOnce(newLock as never);

    await updateArtifacts(updateArtifact);

    expect(exec).toHaveBeenCalledWith('deno install', {
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
