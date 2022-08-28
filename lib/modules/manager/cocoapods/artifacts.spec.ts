import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/fs');
jest.mock('../../platform');
jest.mock('../../datasource');

const datasource = mocked(_datasource);

delete process.env.CP_HOME_DIR;

const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

describe('modules/manager/cocoapods/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    jest.spyOn(docker, 'removeDockerContainer').mockResolvedValue();
    // can't be mocked
    docker.resetPrefetchedImages();

    GlobalConfig.set(adminConfig);

    datasource.getPkgReleases.mockResolvedValue({
      releases: [
        { version: '2.7.4' },
        { version: '3.0.0' },
        { version: '3.1.0' },
      ],
    });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no Podfile.lock found', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null if no updatedDeps were provided', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null for invalid local directory', async () => {
    const execSnapshots = mockExecAll();
    GlobalConfig.set({
      localDir: '',
    });

    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config: {},
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null if updatedDeps is empty', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Podfile');
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [] as string[],
    } as StatusResult);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Podfile');
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Podfile', async () => {
    const execSnapshots = mockExecAll();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.getSiblingFileName.mockReturnValueOnce('Podfile.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile');
    fs.readLocalFile.mockResolvedValueOnce('Old Podfile');
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile');
    fs.readLocalFile.mockResolvedValueOnce('New Podfile');
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: 'plugin "cocoapods-acknowledgements"',
        config,
      })
    ).toMatchSnapshot([{ file: { contents: 'New Podfile' } }]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Podfile and Pods files', async () => {
    const execSnapshots = mockExecAll();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.getSiblingFileName.mockReturnValueOnce('Podfile.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old Manifest.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Podfile');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Pods/Manifest.lock');
    fs.readLocalFile.mockResolvedValueOnce('Pods manifest');
    git.getRepoStatus.mockResolvedValueOnce({
      not_added: ['Pods/New'],
      modified: ['Podfile.lock', 'Pods/Manifest.lock'],
      deleted: ['Pods/Deleted'],
    } as StatusResult);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot([
      { file: { type: 'addition', path: 'Podfile.lock' } },
      { file: { type: 'addition', path: 'Pods/Manifest.lock' } },
      { file: { type: 'addition', path: 'Pods/New' } },
      { file: { type: 'deletion', path: 'Pods/Deleted' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches write error', async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce('Podfile.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Podfile');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Podfile.lock', stderr: 'not found' } },
    ]);
    expect(execSnapshots).toBeEmpty();
  });

  it('returns pod exec error', async () => {
    const execSnapshots = mockExecAll(new Error('exec exception'));
    fs.getSiblingFileName.mockReturnValueOnce('Podfile.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old Podfile.lock');
    fs.outputCacheFile.mockResolvedValueOnce();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('Old Podfile.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Podfile.lock', stderr: 'exec exception' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('dynamically selects Docker image tag', async () => {
    const execSnapshots = mockExecAll();

    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Podfile');

    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);

    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: [{ depName: 'foo' }],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot([
      { cmd: 'docker pull renovate/ruby:2.7.4' },
      {
        cmd:
          'docker run --rm --name=renovate_ruby --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/ruby:2.7.4' +
          ' bash -l -c "' +
          'install-tool cocoapods 1.2.4' +
          ' && ' +
          'pod install' +
          '"',
      },
    ]);
  });

  it('falls back to the `latest` Docker image tag', async () => {
    const execSnapshots = mockExecAll();

    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('COCOAPODS: 1.2.4');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [],
    });

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Podfile.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Podfile');

    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);

    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: [{ depName: 'foo' }],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot([
      { cmd: 'docker pull renovate/ruby:latest' },
      {
        cmd:
          'docker run --rm --name=renovate_ruby --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/ruby:latest' +
          ' bash -l -c "' +
          'install-tool cocoapods 1.2.4' +
          ' && ' +
          'pod install' +
          '"',
      },
    ]);
  });
});
