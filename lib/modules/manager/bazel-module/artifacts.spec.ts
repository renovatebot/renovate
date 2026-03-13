import upath from 'upath';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './artifacts.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('./lockfile.ts');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

describe('modules/manager/bazel-module/artifacts', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no updated deps and not lockfile maintenance', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'MODULE.bazel',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if no MODULE.bazel.lock found', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
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

  it('writes package file and delegates to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('./lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce([
      {
        file: {
          type: 'addition',
          path: 'MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    const result = await updateArtifacts({
      packageFileName: 'MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
      config,
    });

    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'MODULE.bazel',
      'bazel_dep(name = "rules_go", version = "0.42.0")',
    );
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

  it('passes isLockFileMaintenance to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('./lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    await updateArtifacts({
      packageFileName: 'MODULE.bazel',
      updatedDeps: [],
      newPackageFileContent: '',
      config: { ...config, isLockFileMaintenance: true },
    });

    expect(updateBazelLockfile).toHaveBeenCalledWith(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      true,
      undefined,
    );
  });

  it('passes bazelisk constraint to updateBazelLockfile', async () => {
    const { updateBazelLockfile } = await import('./lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce(null);
    fs.getSiblingFileName.mockReturnValueOnce('MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    await updateArtifacts({
      packageFileName: 'MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
      config: { ...config, constraints: { bazelisk: '>=1.18.0' } },
    });

    expect(updateBazelLockfile).toHaveBeenCalledWith(
      'MODULE.bazel.lock',
      'MODULE.bazel',
      undefined,
      '>=1.18.0',
    );
  });

  it('handles subdirectory MODULE.bazel', async () => {
    const { updateBazelLockfile } = await import('./lockfile.ts');
    vi.mocked(updateBazelLockfile).mockResolvedValueOnce([
      {
        file: {
          type: 'addition',
          path: 'subdir/MODULE.bazel.lock',
          contents: 'new lock content',
        },
      },
    ]);
    fs.getSiblingFileName.mockReturnValueOnce('subdir/MODULE.bazel.lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock content');

    const result = await updateArtifacts({
      packageFileName: 'subdir/MODULE.bazel',
      updatedDeps: [{ depName: 'rules_go' }],
      newPackageFileContent: 'bazel_dep(name = "rules_go", version = "0.42.0")',
      config,
    });

    expect(updateBazelLockfile).toHaveBeenCalledWith(
      'subdir/MODULE.bazel.lock',
      'subdir/MODULE.bazel',
      undefined,
      undefined,
    );
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
