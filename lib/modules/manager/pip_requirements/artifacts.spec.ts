import { join } from 'upath';
import { mockExecAll } from '../../../../test/exec-util';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/common');
jest.mock('../../../util/fs');
jest.mock('../../datasource');

process.env.BUILDPACK = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = { constraints: { python: '3.10.2' } };

/*
 * Sample package file content that exhibits dependencies with and without
 * "extras" specifications as well as line continuations and additional
 * (valid) whitespace.
 */
const newPackageFileContent = `atomicwrites==1.4.0 \\\n\
  --hash=sha256:03472c30eb2c5d1ba9227e4c2ca66ab8287fbfbbda3888aa93dc2e28fc6811b4 \\\n\
  --hash=sha256:75a9445bac02d8d058d5e1fe689654ba5a6556a1dfd8ce6ec55a0ed79866cfa6\n\
 boto3-stubs[iam] == 1.24.36.post1 \
--hash=sha256:39acbbc8c87a101bdf46e058fbb012d044b773b43f7ed02cc4c24192a564411e \
--hash=sha256:ca3b3066773fc727fea0dbec252d098098e45fe0def011b22036ef674344def2\n\
botocore==1.27.46 \
--hash=sha256:747b7e94aef41498f063fc0be79c5af102d940beea713965179e1ead89c7e9ec \
--hash=sha256:f66d8305d1f59d83334df9b11b6512bb1e14698ec4d5d6d42f833f39f3304ca7`;

describe('modules/manager/pip_requirements/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [],
        newPackageFileContent,
        config,
      })
    ).toBeNull();
  });

  it('returns null if no hashes', async () => {
    fs.readLocalFile.mockResolvedValueOnce('eventlet==0.30.2\npbr>=1.9\n');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'eventlet' }],
        newPackageFileContent,
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(newPackageFileContent);
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'atomicwrites' }, { depName: 'boto3-stubs' }],
        newPackageFileContent,
        config,
      })
    ).toBeNull();

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'hashin atomicwrites==1.4.0 -r requirements.txt',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: "hashin 'boto3-stubs[iam] == 1.24.36.post1' -r requirements.txt",
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('returns updated file', async () => {
    fs.readLocalFile.mockResolvedValueOnce('new content');
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'atomicwrites' }, { depName: 'boto3-stubs' }],
        newPackageFileContent,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'requirements.txt',
          contents: 'new content',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'hashin atomicwrites==1.4.0 -r requirements.txt',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: "hashin 'boto3-stubs[iam] == 1.24.36.post1' -r requirements.txt",
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('ignores falsy depNames', async () => {
    fs.readLocalFile.mockResolvedValueOnce('new content');
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [
          { depName: '' },
          { depName: 'atomicwrites' },
          { depName: undefined },
        ],
        newPackageFileContent,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'requirements.txt',
          contents: 'new content',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'hashin atomicwrites==1.4.0 -r requirements.txt',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches and returns errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockImplementation(() => {
      throw new Error('some-error');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'atomicwrites' }],
        newPackageFileContent,
        config,
      })
    ).toEqual([
      {
        artifactError: {
          lockFile: 'requirements.txt',
          stderr: `undefined\nundefined`,
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'hashin atomicwrites==1.4.0 -r requirements.txt',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('new content');
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/cache');
    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'atomicwrites' }],
        newPackageFileContent,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'requirements.txt',
          contents: 'new content',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.10.2 ' +
          '&& ' +
          'pip install --user hashin ' +
          '&& ' +
          'hashin atomicwrites==1.4.0 -r requirements.txt' +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('new content');
    const execSnapshots = mockExecAll();

    expect(
      await updateArtifacts({
        packageFileName: 'requirements.txt',
        updatedDeps: [{ depName: 'atomicwrites' }],
        newPackageFileContent,
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'requirements.txt',
          contents: 'new content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.10.2' },
      { cmd: 'pip install --user hashin' },
      {
        cmd: 'hashin atomicwrites==1.4.0 -r requirements.txt',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });
});
