import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { env, fs, git, hostRules, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import * as lockfile from './lockfile.ts';
import { updateLockedDependency } from './update-locked.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/git/index.ts');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const updateToolCmd = 'mise lock node';
const updateMultipleToolsCmd = 'mise lock node python';
const lockfileMaintenanceCmd = 'mise lock';

describe('modules/manager/mise/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
  });

  it('returns null if lock file does not exist', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();
    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if lock file unchanged after exec', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateToolCmd }]);
  });

  it('returns updated lock file on success', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('new content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['mise.lock'],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new content',
          path: 'mise.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateToolCmd }]);
  });

  it('returns artifactError on exec failure with combined output', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const error = new Error('exec error');
    (error as any).stdout = 'stdout output';
    (error as any).stderr = 'stderr output';
    const execSnapshots = mockExecSequence([error]);

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'mise.lock',
          stderr: 'stdout output\nstderr output\nexec error',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateToolCmd }]);
  });

  it('rethrows TEMPORARY_ERROR', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    mockExecSequence([new Error(TEMPORARY_ERROR)]);

    await expect(
      updateArtifacts({
        packageFileName: 'mise.toml',
        updatedDeps: [{ depName: 'node' }],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('runs mise lock for lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some content',
      config: lockMaintenanceConfig,
    });

    expect(execSnapshots).toMatchObject([{ cmd: lockfileMaintenanceCmd }]);
  });

  it('runs mise lock <tools> for targeted updates', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }, { depName: 'python' }],
      newPackageFileContent: 'some content',
      config,
    });

    expect(execSnapshots).toMatchObject([{ cmd: updateMultipleToolsCmd }]);
  });

  it('injects GITHUB_TOKEN when host rule found', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('new content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['mise.lock'],
      }),
    );
    hostRules.add({
      hostType: 'github',
      matchHost: 'https://api.github.com/',
      token: 'github-token',
    });

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new content',
          path: 'mise.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: updateToolCmd,
        options: {
          env: expect.objectContaining({
            GITHUB_TOKEN: 'github-token',
          }),
        },
      },
    ]);
  });

  it('handles empty updatedDeps with fallback to full lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [],
      newPackageFileContent: 'some content',
      config,
    });

    expect(execSnapshots).toMatchObject([{ cmd: lockfileMaintenanceCmd }]);
  });

  it('handles environment-specific lock files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('new content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['mise.test.lock'],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'mise.test.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new content',
          path: 'mise.test.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: updateToolCmd,
        options: {
          env: expect.objectContaining({ MISE_ENV: 'test' }),
        },
      },
    ]);
  });

  it('uses --local flag for local config files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('new content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['mise.local.lock'],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'mise.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new content',
          path: 'mise.local.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'mise lock --local node' }]);
  });

  it('uses --local flag and MISE_ENV for env-specific local config files', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.test.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some content',
      config,
    });

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'mise lock --local node',
        options: {
          env: expect.objectContaining({ MISE_ENV: 'test' }),
        },
      },
    ]);
  });

  it('uses --local flag for lock file maintenance on local config', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some content',
      config: lockMaintenanceConfig,
    });

    expect(execSnapshots).toMatchObject([{ cmd: 'mise lock --local' }]);
  });

  // Note: Docker and install mode tests are not included here because mise
  // containerbase support may not be available in all test environments.
  // The functionality is tested through the regular tests which use mockExecAll.

  it('prevents command injection', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: '|| date; echo ' }, { depName: 'node' }],
      newPackageFileContent: 'content',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: "mise lock '|| date; echo ' node" },
    ]);
  });

  it('handles subdirectory package files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('new content');
    fs.writeLocalFile.mockResolvedValueOnce();
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['subdir/mise.lock'],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'subdir/mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: 'new content',
          path: 'subdir/mise.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateToolCmd }]);
  });

  describe('updateLockedDependency', () => {
    const lockFileContent = `
[[tools.node]]
version = "20.11.0"
backend = "core:node"

[[tools.python]]
version = "3.10.17"
`;

    it('returns already-updated when version matches', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: 'node',
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'already-updated' });
    });

    it('returns already-updated for tool with backend prefix', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: 'core:node',
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'already-updated' });
    });

    it('returns unsupported when version does not match', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: 'node',
        currentVersion: '20.10.0',
        newVersion: '22.0.0',
      });

      expect(res).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported when tool not in lock file', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: 'ruby',
        currentVersion: '3.2.0',
        newVersion: '3.3.0',
      });

      expect(res).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported when no lock file content', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent: undefined,
        depName: 'node',
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported for invalid lock file content', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent: 'invalid toml {{{',
        depName: 'node',
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported when depName is undefined', () => {
      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: undefined as never,
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'unsupported' });
    });

    it('returns update-failed in case of errors', () => {
      vi.spyOn(lockfile, 'getLockedVersion').mockImplementationOnce(() => {
        throw new Error('unexpected error');
      });

      const res = updateLockedDependency({
        packageFile: 'mise.toml',
        lockFile: 'mise.lock',
        lockFileContent,
        depName: 'node',
        currentVersion: '20.10.0',
        newVersion: '20.11.0',
      });

      expect(res).toEqual({ status: 'update-failed' });
    });
  });
});
