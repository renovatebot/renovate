import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, hostRules, mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../datasource', () => mockDeep());

const getPkgReleases = mockedFunction(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

// support install mode
process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};

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
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
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

  it('returns updated mix.lock', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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
        { version: '1.8.2' },
        { version: '1.13.3' },
        { version: '1.13.4' },
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
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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

  it('authenticates to private repositories in updated dependecies', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'docker',
      dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
    });
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('subdir/mix.lock');
    mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'subdir/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      }),
    ).toBeNull();
    expect(fs.readLocalFile).toHaveBeenCalledWith('subdir/mix.lock', 'utf8');
  });

  it('catches write errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('mix.lock');
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
});
