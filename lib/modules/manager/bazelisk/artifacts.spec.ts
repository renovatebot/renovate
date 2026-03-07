import upath from 'upath';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/bazelisk/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    docker.resetPrefetchedImages();
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no updated deps and not lockfile maintenance', async () => {
    expect(
      await updateArtifacts({
        packageFileName: '.bazelversion',
        updatedDeps: [],
        newPackageFileContent: '7.7.1\n',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no MODULE.bazel found', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(
      await updateArtifacts({
        packageFileName: '.bazelversion',
        updatedDeps: [{ depName: 'bazel' }],
        newPackageFileContent: '7.7.1\n',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no MODULE.bazel.lock found', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(
      await updateArtifacts({
        packageFileName: '.bazelversion',
        updatedDeps: [{ depName: 'bazel' }],
        newPackageFileContent: '7.7.1\n',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if lockfile is not modified after exec', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config,
    });

    expect(result).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'bazel mod deps' }]);
  });

  it('returns updated lockfile when modified', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'bazel mod deps' }]);
  });

  it('returns updated lockfile when not_added includes lockfile', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'bazel mod deps' }]);
  });

  it('returns null if lockfile maintenance produces no changes', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [],
      newPackageFileContent: '7.7.1\n',
      config: { ...config, isLockFileMaintenance: true },
    });

    expect(result).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'bazel mod deps' }]);
  });

  it('returns updated lockfile during lockfile maintenance', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [],
      newPackageFileContent: '7.7.1\n',
      config: { ...config, isLockFileMaintenance: true },
    });

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'bazel mod deps' }]);
  });

  it('returns artifactError on exec failure', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    mockExecAll(new Error('bazel mod deps failed'));

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config,
    });

    expect(result).toEqual([
      {
        artifactError: {
          lockFile: 'MODULE.bazel.lock',
          stderr: 'bazel mod deps failed',
        },
      },
    ]);
  });

  it('re-throws TEMPORARY_ERROR', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    mockExecAll(new Error(TEMPORARY_ERROR));

    await expect(
      updateArtifacts({
        packageFileName: '.bazelversion',
        updatedDeps: [{ depName: 'bazel' }],
        newPackageFileContent: '7.7.1\n',
        config,
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });
});
