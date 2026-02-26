import upath from 'upath';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git } from '~test/util.ts';
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

describe('modules/manager/bazel-module/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    docker.resetPrefetchedImages();
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no MODULE.bazel.lock found', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(
      await updateArtifacts({
        packageFileName: 'MODULE.bazel',
        updatedDeps: [{ depName: 'rules_go' }],
        newPackageFileContent:
          'bazel_dep(name = "rules_go", version = "0.42.0")',
        config,
      }),
    ).toBeNull();
  });

  it('returns updated MODULE.bazel.lock when modified', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['MODULE.bazel.lock'],
    } as StatusResult);

    const result = await updateArtifacts({
      packageFileName: 'MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
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

  it('returns null if MODULE.bazel.lock is unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [] as string[],
    } as unknown as StatusResult);

    expect(
      await updateArtifacts({
        packageFileName: 'MODULE.bazel',
        updatedDeps: [{ depName: 'rules_go' }],
        newPackageFileContent:
          'bazel_dep(name = "rules_go", version = "0.42.0")',
        config,
      }),
    ).toBeNull();
  });

  it('returns artifactError on exec failure', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    mockExecAll(new Error('bazel mod deps failed'));

    const result = await updateArtifacts({
      packageFileName: 'MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
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
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    mockExecAll(new Error(TEMPORARY_ERROR));

    await expect(
      updateArtifacts({
        packageFileName: 'MODULE.bazel',
        updatedDeps: [{ depName: 'rules_go' }],
        newPackageFileContent:
          'bazel_dep(name = "rules_go", version = "0.42.0")',
        config,
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('handles subdirectory MODULE.bazel', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock content');
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['subdir/MODULE.bazel.lock'],
    } as StatusResult);

    const result = await updateArtifacts({
      packageFileName: 'subdir/MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
      config,
    });

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'subdir/MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
  });
});
