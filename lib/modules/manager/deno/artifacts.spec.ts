import type { DirectoryResult } from 'tmp-promise';
import tmp from 'tmp-promise';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');

const updateArtifact: UpdateArtifact = {
  config: {
    constraints: { deno: '2.4.5' },
  },
  newPackageFileContent: '',
  packageFileName: '',
  updatedDeps: [],
};

describe('modules/manager/deno/artifacts', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('updateArtifacts()', () => {
    let localDirResult: DirectoryResult;
    let localDir: string;

    beforeEach(async () => {
      localDirResult = await tmp.dir({ unsafeCleanup: true });
      localDir = localDirResult.path;

      GlobalConfig.set({ localDir, binarySource: 'global' });
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
            fileName: 'deno.lock',
            stderr: `Failed to read "deno.lock"`,
          },
        },
      ]);
    });

    it('returns null if lock content unchanged', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      // Second read is .npmrc
      fs.readLocalFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated lock content', async () => {
      updateArtifact.updatedDeps = [{ lockFiles: ['deno.lock'] }];
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      // Second read is .npmrc
      fs.readLocalFile.mockResolvedValueOnce(null);
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      mockExecAll();
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      // Second read is .npmrc
      fs.readLocalFile.mockResolvedValueOnce(null);
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      mockExecAll();
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      // Second read is .npmrc
      fs.readLocalFile.mockResolvedValueOnce(null);
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      mockExecAll();
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      mockExecAll(execError);
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
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      mockExecAll(execError);
      expect(await updateArtifacts(updateArtifact)).toEqual([
        { artifactError: { fileName: 'deno.lock', stderr: 'nope' } },
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
    fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
    // Second read is .npmrc
    fs.readLocalFile.mockResolvedValueOnce(null);
    const newLock = Buffer.from('new');
    fs.readLocalFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        artifactError: {
          fileName: 'deno.lock',
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
    fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
    // Second read is .npmrc
    fs.readLocalFile.mockResolvedValueOnce(null);
    const newLock = Buffer.from('new');
    fs.readLocalFile.mockResolvedValueOnce(newLock as never);

    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        artifactError: {
          fileName: 'deno.lock',
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
    fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
    // Second read is .npmrc
    fs.readLocalFile.mockResolvedValueOnce(null);
    const newLock = Buffer.from('new');
    fs.readLocalFile.mockResolvedValueOnce(newLock as never);
    const execSnapshots = mockExecAll();
    expect(await updateArtifacts(updateArtifact)).toEqual([
      {
        file: {
          path: 'deno.lock',
          type: 'addition',
          contents: newLock,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'deno install --frozen=false',
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
    fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
    // Second read is .npmrc
    fs.readLocalFile.mockResolvedValueOnce(null);
    const newLock = Buffer.from('new');
    fs.readLocalFile.mockResolvedValueOnce(newLock as never);
    const execSnapshots = mockExecAll();

    await updateArtifacts(updateArtifact);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'deno install',
      },
    ]);
  });

  describe('private registries', () => {
    it('should add private registries to deno install command allow-import option', async () => {
      const updateArtifact: UpdateArtifact = {
        config: {
          updateType: 'lockFileMaintenance',
          lockFiles: ['deno.lock'],
        },
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [],
      };
      const oldLock = Buffer.from('old');
      fs.readLocalFile.mockResolvedValueOnce(oldLock as never);
      // Second read is .npmrc
      fs.readLocalFile.mockResolvedValueOnce(null);
      const newLock = Buffer.from('new');
      fs.readLocalFile.mockResolvedValueOnce(newLock as never);
      hostRules.add({
        token: 'some-token',
        hostType: 'npm',
        matchHost: 'https://private-registry.example',
      });
      const execSnapshots = mockExecAll();
      expect(await updateArtifacts(updateArtifact)).toEqual([
        {
          file: {
            path: 'deno.lock',
            type: 'addition',
            contents: newLock,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'deno install --frozen=false --allow-import=deno.land:443,esm.sh:443,jsr.io:443,cdn.jsdelivr.net:443,raw.githubusercontent.com:443,gist.githubusercontent.com:443,private-registry.example',
        },
      ]);
    });
  });
});
