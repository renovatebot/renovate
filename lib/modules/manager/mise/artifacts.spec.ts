import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { env, fs, hostRules } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import * as _datasource from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';
import * as lockfile from './lockfile.ts';
import { updateLockedDependency } from './update-locked.ts';

const datasource = vi.mocked(_datasource);

vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  binarySource: 'global',
  allowedUnsafeExecutions: ['mise'],
};

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };
const trustCmd = 'mise trust mise.toml';
const updateToolCmd = 'mise lock node';
const trustLocalCmd = 'mise trust mise.local.toml';
const trustEnvCmd = 'mise trust mise.test.toml';
const trustEnvLocalCmd = 'mise trust mise.test.local.toml';
const trustSubdirCmd = 'mise trust mise.toml';
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
    datasource.getPkgReleases.mockReset();
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

  it('returns null when mise is not allowlisted', async () => {
    GlobalConfig.set({ ...adminConfig, allowedUnsafeExecutions: [] });
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if lock file unchanged after exec', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: updateToolCmd },
    ]);
  });

  it('returns updated lock file on success', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce(`[[tools.node]]\nversion = "24.16.0"\n`);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: expect.stringContaining('version = "24.16.0"'),
          path: 'mise.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: updateToolCmd },
    ]);
  });

  it('returns artifactError on exec failure with combined output', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    const error = new Error('exec error');
    (error as any).stdout = 'stdout output';
    (error as any).stderr = 'stderr output';
    const execSnapshots = mockExecSequence([error]);

    const res = await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'mise.lock',
          stderr: `stdout output\nstderr output\nexec error`,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: trustCmd }]);
  });

  it('rethrows TEMPORARY_ERROR', async () => {
    fs.readLocalFile.mockResolvedValueOnce('existing content');
    mockExecSequence([new Error(TEMPORARY_ERROR)]);

    await expect(
      updateArtifacts({
        packageFileName: 'mise.toml',
        updatedDeps: [{ depName: 'node' }],
        newPackageFileContent: '',
        config,
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('runs mise lock for lockFileMaintenance', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config: lockMaintenanceConfig,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: lockfileMaintenanceCmd },
    ]);
  });

  it('runs mise lock <tools> for targeted updates', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }, { depName: 'python' }],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: updateMultipleToolsCmd },
    ]);
  });

  it('looks up latest versions for tool versions before `mise lock`, if not set', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });

    for (const version of ['1.2.3', '2.3.4', '3.4.5', '4.5.6', '5.6.7']) {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: version }],
      });
    }

    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config: {
        // no constraints
      },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool mise 1.2.3' },
      { cmd: 'install-tool node 2.3.4' },
      { cmd: 'install-tool npm 3.4.5' },
      { cmd: 'install-tool golang 4.5.6' },
      { cmd: 'install-tool ruby 5.6.7' },
      { cmd: trustCmd },
      { cmd: updateToolCmd },
    ]);
  });

  it('uses constraints to specify tool versions before `mise lock`, if set', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config: {
        constraints: {
          mise: '2026.6.12',
          node: '24.16.0',
          npm: '11.4.2',
          go: '1.24.4',
          ruby: '3.4.3',
        },
      },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool mise 2026.6.12' },
      { cmd: 'install-tool node 24.16.0' },
      { cmd: 'install-tool npm 11.4.2' },
      { cmd: 'install-tool golang 1.24.4' },
      { cmd: 'install-tool ruby 3.4.3' },
      { cmd: trustCmd },
      { cmd: updateToolCmd },
    ]);
  });

  it.each`
    depName                              | oldVersion    | newVersion    | newPackageFileContent
    ${'npm:renovate'}                    | ${'43.220.0'} | ${'43.233.3'} | ${`[tools]\n"npm:renovate" = "43.233.3"\n`}
    ${'go:github.com/DarthSim/hivemind'} | ${'1.0.0'}    | ${'1.1.0'}    | ${`[tools]\n"go:github.com/DarthSim/hivemind" = { version = "1.1.0", install_env = { GOPROXY = "direct" } }\n`}
    ${'gem:rubocop'}                     | ${'1.75.0'}   | ${'1.76.0'}   | ${`[tools]\n"gem:rubocop" = "1.76.0"\n`}
  `(
    'updates mise.lock for $depName with dynamic installs and no constraints',
    async ({ depName, oldVersion, newVersion, newPackageFileContent }) => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      datasource.getPkgReleases.mockResolvedValue({
        releases: [{ version: '1.0.0' }],
      });
      const oldLockFileContent = `[[tools."${depName}"]]\nversion = "${oldVersion}"\nbackend = "${depName}"\n`;
      const newLockFileContent = `[[tools."${depName}"]]\nversion = "${newVersion}"\nbackend = "${depName}"\n`;
      fs.readLocalFile
        .mockResolvedValueOnce(oldLockFileContent)
        .mockResolvedValueOnce(newLockFileContent);
      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'mise.toml',
        updatedDeps: [{ depName }],
        newPackageFileContent,
        config,
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'mise.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool mise 1.0.0' },
        { cmd: 'install-tool node 1.0.0' },
        { cmd: 'install-tool npm 1.0.0' },
        { cmd: 'install-tool golang 1.0.0' },
        { cmd: 'install-tool ruby 1.0.0' },
        { cmd: trustCmd },
        { cmd: `mise lock ${depName}` },
      ]);
    },
  );

  it('injects GITHUB_TOKEN when host rule found', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce(`[[tools.node]]\nversion = "24.16.0"\n`);
    const execSnapshots = mockExecAll();
    hostRules.add({
      hostType: 'github',
      matchHost: 'https://api.github.com/',
      token: 'github-token',
    });

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      {
        cmd: updateToolCmd,
        options: {
          cwd: '/tmp/github/some/repo',
          env: expect.objectContaining({
            GITHUB_TOKEN: 'github-token',
          }),
        },
      },
    ]);
  });

  it('handles empty updatedDeps with fallback to full lock', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: lockfileMaintenanceCmd },
    ]);
  });

  it('handles environment-specific lock files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce(`[[tools.node]]\nversion = "24.16.0"\n`);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'mise.test.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: expect.stringContaining('version = "24.16.0"'),
          path: 'mise.test.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: trustEnvCmd },
      {
        cmd: updateToolCmd,
        options: {
          env: expect.objectContaining({
            MISE_ENV: 'test',
          }),
        },
      },
    ]);
  });

  it('uses --local flag for local config files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce(`[[tools.node]]\nversion = "24.16.0"\n`);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'mise.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: expect.stringContaining('version = "24.16.0"'),
          path: 'mise.local.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: trustLocalCmd },
      { cmd: 'mise lock --local node' },
    ]);
  });

  it('uses --local flag and MISE_ENV for env-specific local config files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.test.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustEnvLocalCmd },
      {
        cmd: 'mise lock --local node',
        options: {
          env: expect.objectContaining({
            MISE_ENV: 'test',
          }),
        },
      },
    ]);
  });

  it('uses --local flag for lock file maintenance on local config', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.local.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config: lockMaintenanceConfig,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustLocalCmd },
      { cmd: 'mise lock --local' },
    ]);
  });

  it('prevents command injection', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce('existing content');
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'mise.toml',
      updatedDeps: [{ depName: '|| date; echo ' }, { depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchObject([
      { cmd: trustCmd },
      { cmd: "mise lock '|| date; echo ' node" },
    ]);
  });

  it('handles subdirectory package files', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('existing content')
      .mockResolvedValueOnce(`[[tools.node]]\nversion = "24.16.0"\n`);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'subdir/mise.toml',
      updatedDeps: [{ depName: 'node' }],
      newPackageFileContent: '',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          contents: expect.stringContaining('version = "24.16.0"'),
          path: 'subdir/mise.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: trustSubdirCmd },
      {
        cmd: updateToolCmd,
        options: {
          cwd: '/tmp/github/some/repo/subdir',
        },
      },
    ]);
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
