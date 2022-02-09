import { join } from 'upath';
import { envMock, exec, mockExecAll } from '../../../test/exec-util';
import { env, fs, hostRules } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/fs');
jest.mock('../../util/host-rules');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
};

const config: UpdateArtifactsConfig = {};

describe('manager/mix/artifacts', () => {
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
    const execSnapshots = mockExecAll(exec);
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
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
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
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    hostRules.find.mockReturnValueOnce({ token: 'valid_test_token' });
    hostRules.find.mockReturnValueOnce({});

    const result = await updateArtifacts({
      packageFileName: 'mix.exs',
      updatedDeps: [
        {
          depName: 'private_package',
          lookupName: 'private_package:renovate_test',
        },
        {
          depName: 'other_package',
          lookupName: 'other_package:unauthorized_organization',
        },
      ],
      newPackageFileContent: '{}',
      config,
    });

    expect(result).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();

    const [updateResult] = result;
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
    mockExecAll(exec);
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
    exec.mockImplementationOnce(() => {
      throw new Error('exec-error');
    });
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
