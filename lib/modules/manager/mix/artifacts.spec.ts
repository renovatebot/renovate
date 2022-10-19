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
jest.mock('../../../util/host-rules');
jest.mock('../../datasource');

const getPkgReleases = mockedFunction(_getPkgReleases);

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/mix/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

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
      })
    ).toBeNull();
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '',
        config,
      })
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
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated mix.lock', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
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
      })
    ).toEqual([
      {
        file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('authenticates to private repositories', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
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

    // TODO #7154
    const [updateResult] = result!;
    expect(updateResult).toEqual({
      file: { type: 'addition', path: 'mix.lock', contents: 'New mix.lock' },
    });

    const [, packageUpdateCommand] = execSnapshots;
    expect(packageUpdateCommand.cmd).toInclude(
      'mix hex.organization auth renovate_test --key valid_test_token && ' +
        'mix deps.update private_package other_package'
    );
  });

  it('returns updated mix.lock in subdir', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('subdir/mix.lock');
    mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'subdir/mix.exs',
        updatedDeps: [{ depName: 'plug' }],
        newPackageFileContent: '{}',
        config,
      })
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
      })
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
      })
    ).toEqual([
      { artifactError: { lockFile: 'mix.lock', stderr: 'exec-error' } },
    ]);
  });
});
