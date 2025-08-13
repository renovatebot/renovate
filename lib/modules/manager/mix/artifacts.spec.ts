import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { env, fs, hostRules } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');
vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('../../datasource', () => mockDeep());

const getPkgReleases = vi.mocked(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

// support install mode
process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const constraints: Record<string, string> = {
  erlang: '25.0.0.0',
  elixir: 'v1.13.4',
};

describe('modules/manager/mix/artifacts', () => {
  beforeEach(() => {
    hostRules.getAll.mockReturnValue([]);

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no mix.lock found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null when trying to use lockFileMaintenance with no mix.lock file', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

    fs.writeLocalFile.mockClear(); // Clear the mock to ensure we can check if it's called

    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toBeNull();

    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('returns null if no updatedDeps and no lockFileMaintenance', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if using lockFileMaintenance in umbrella project', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toBeNull();
  });

  it('returns updated mix.lock', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '22.3.4.26' },
        { version: '23.1.1.0' },
        { version: '24.3.4.1' },
        { version: '24.3.4.2' },
        { version: '25.0.0.0' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('uses constraints on install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints: { erlang: '26.0.0', elixir: '1.14.5' },
        },
      }),
    ).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 26.0.0' },
      { cmd: 'install-tool elixir 1.14.5' },
      { cmd: 'mix deps.update plug' },
    ]);
  });

  it('authenticates to private repositories in updated dependencies', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    hostRules.find.mockReturnValueOnce({ token: 'valid_test_token' });
    hostRules.find.mockReturnValueOnce({});

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '22.3.4.26' },
        { version: '23.1.1.0' },
        { version: '24.3.4.1' },
        { version: '24.3.4.2' },
        { version: '25.0.0.0' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    const result = await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [
        {
          depName: 'private_package',
          packageName: 'private_package:renovate_test',
        },
        {
          depName: 'other_package',
          packageName: 'other_package:unauthorized_organization',
        },
      ],
      newPackageFileContent: '{}',
      config,
    });

    expect(result).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();

    // TODO #22198
    const [updateResult] = result!;
    expect(updateResult).toEqual({
      file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
    });

    const [, packageUpdateCommand] = execSnapshots;
    expect(packageUpdateCommand.cmd).toInclude(
      'mix hex.organization auth renovate_test --key valid_test_token && ' +
        'mix deps.update private_package other_package',
    );
  });

  it('authenticates to private repositories configured in hostRules', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    hostRules.getAll.mockReturnValueOnce([
      { matchHost: 'https://hex.pm/api/repos/an_organization/' },
      { matchHost: 'https://hex.pm/api/repos/unauthorized_organization/' },
      { matchHost: 'https://hex.pm/api/repos/other_organization/' },
      { matchHost: 'https://hex.pm/api/repos/does_not_match_org/packages/' },
      { matchHost: 'https://example.com/api/repos/also_does_not_match_org/' },
      { matchHost: 'hex.pm' },
    ]);
    hostRules.find.mockReturnValueOnce({ token: 'an_organization_token' });
    hostRules.find.mockReturnValueOnce({}); // unauthorized_organization token missing
    hostRules.find.mockReturnValueOnce({ token: 'other_org_token' });
    hostRules.find.mockReturnValueOnce({ token: 'does_not_match_org_token' });

    // erlang
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '22.3.4.26' },
        { version: '23.1.1.0' },
        { version: '24.3.4.1' },
        { version: '24.3.4.2' },
        { version: '25.0.0.0' },
      ],
    });
    // elixir
    getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: 'v1.8.2' },
        { version: 'v1.13.3' },
        { version: 'v1.13.4' },
      ],
    });

    const result = await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [{ depName: 'some_package' }],
      newPackageFileContent: '{}',
      config,
    });

    expect(result).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix hex.organization auth an_organization --key an_organization_token',
      },
      {
        cmd: 'mix hex.organization auth other_organization --key other_org_token',
      },
      { cmd: 'mix deps.update some_package' },
    ]);
  });

  it('returns updated mix.lock in subdir', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('subdir/mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'subdir/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints },
      }),
    ).toEqual([
      {
        file: {
          path: 'subdir/mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.update plug',
        options: { cwd: '/tmp/github/some/repo/subdir' },
      },
    ]);
  });

  it('returns updated mix.lock in umbrella project', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config: { ...config, constraints },
      }),
    ).toEqual([
      {
        file: {
          path: 'mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.update plug',
        options: { cwd: '/tmp/github/some/repo/apps/foo' },
      },
    ]);
  });

  it('supports lockFileMaintenance', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');

    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          constraints,
          isLockFileMaintenance: true,
        },
      }),
    ).toEqual([
      {
        file: {
          path: 'mix.lock',
          type: 'addition',
          contents: 'New mix.lock',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool erlang 25.0.0.0' },
      { cmd: 'install-tool elixir v1.13.4' },
      {
        cmd: 'mix deps.get',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('lockFileMaintenance returns null if unchanged', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');

    mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toBeNull();
  });

  it('catches write errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      { artifactError: { lockFile: 'mix.lock', stderr: 'not found' } },
    ]);
  });

  it('catches exec errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    mockExecAll(new Error('exec-error'));
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      { artifactError: { lockFile: 'mix.lock', stderr: 'exec-error' } },
    ]);
  });

  it('detects read errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      {
        artifactError: {
          lockFile: 'mix.lock',
          stderr: 'Error reading mix.lock',
        },
      },
    ]);
  });

  it('detects read errors (umbrella)', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('apps/foo/mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);
    expect(
      await updateArtifacts({
        packageFileName: 'apps/foo/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      {
        artifactError: {
          lockFile: 'mix.lock',
          stderr: 'Error reading mix.lock',
        },
      },
    ]);
  });

  it("handles updates and doesn't try to create mix.lock file if it doesn't exist", async () => {
    fs.getSiblingFileName.mockReturnValueOnce('mix.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(false);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: 'New mix.exs',
        config,
      }),
    ).toBeNull();

    expect(execSnapshots).toHaveLength(0);
    expect(fs.writeLocalFile).toHaveBeenCalledWith('mix.exs', 'New mix.exs');
  });
});
