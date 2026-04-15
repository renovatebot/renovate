import upath from 'upath';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git, logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import { updateBazelLockfile } from './lockfile.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  allowedUnsafeExecutions: ['bazelModDeps'],
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

describe('modules/manager/bazel-module/lockfile', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    docker.resetPrefetchedImages();
    GlobalConfig.set(adminConfig);
  });

  it('returns updated lockfile when modified', async () => {
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      undefined,
    );

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'bazel mod deps --lockfile_mode=update' },
    ]);
    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
  });

  it('returns updated lockfile when in not_added', async () => {
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      undefined,
    );

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'bazel mod deps --lockfile_mode=update' },
    ]);
  });

  it('returns null when lockfile is not modified', async () => {
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      undefined,
    );

    expect(result).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'bazel mod deps --lockfile_mode=update' },
    ]);
  });

  it('deletes lockfile during maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('new lock content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['MODULE.bazel.lock'],
      }),
    );

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      true,
      undefined,
    );

    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'bazel mod deps --lockfile_mode=update' },
    ]);
    expect(fs.deleteLocalFile).toHaveBeenCalledWith('MODULE.bazel.lock');
  });

  it('does not delete lockfile when not in maintenance', async () => {
    mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      false,
      undefined,
    );

    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
  });

  it('re-throws TEMPORARY_ERROR', async () => {
    mockExecAll(new Error(TEMPORARY_ERROR));

    await expect(
      updateBazelLockfile(
        'MODULE.bazel.lock',
        'MODULE.bazel',
        undefined,
        undefined,
      ),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('returns artifactError on exec failure', async () => {
    mockExecAll(new Error('bazel mod deps failed'));

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      undefined,
    );

    expect(result).toEqual([
      {
        artifactError: {
          fileName: 'MODULE.bazel.lock',
          stderr: 'bazel mod deps failed',
        },
      },
    ]);
  });

  it('returns null when bazelModDeps is not allowed', async () => {
    GlobalConfig.set({ ...adminConfig, allowedUnsafeExecutions: [] });
    const execSnapshots = mockExecAll();

    const result = await updateBazelLockfile(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      undefined,
    );

    expect(result).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
    expect(logger.logger.once.warn).toHaveBeenCalledWith(
      'Bazel command, `bazel mod deps --lockfile_mode=update`, was requested to run, but `bazelModDeps` is not permitted in the allowedUnsafeExecutions',
    );
  });
});
