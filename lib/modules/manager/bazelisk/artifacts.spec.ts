import upath from 'upath';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../bazel-module/lockfile.ts');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/bazelisk/artifacts', () => {
  beforeEach(() => {
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

  it('writes package file and delegates to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('../bazel-module/lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    const result = await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config,
    });

    expect(fs.writeLocalFile).toHaveBeenCalledWith('.bazelversion', '7.7.1\n');
    expect(updateBazelLockfile).toHaveBeenCalledWith(
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
  });

  it('passes bazelisk constraint to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('../bazel-module/lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [{ depName: 'bazel' }],
      newPackageFileContent: '7.7.1\n',
      config: { ...config, constraints: { bazelisk: '>=1.18.0' } },
    });

    expect(updateBazelLockfile).toHaveBeenCalledWith(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      '>=1.18.0',
    );
  });

  it('passes isLockFileMaintenance to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('../bazel-module/lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel');
    fs.readLocalFile.mockResolvedValueOnce('module(name = "my_project")');
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    await updateArtifacts({
      packageFileName: '.bazelversion',
      updatedDeps: [],
      newPackageFileContent: '7.7.1\n',
      config: { ...config, isLockFileMaintenance: true },
    });

    expect(updateBazelLockfile).toHaveBeenCalledWith(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      true,
      undefined,
    );
  });
});
