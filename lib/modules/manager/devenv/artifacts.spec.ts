import type { StatusResult } from 'simple-git';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { env, fs, git, partial } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');
vi.mock('../../../util/host-rules', () => mockDeep());

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};
const updateCmd = 'devenv update';

describe('modules/manager/devenv/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no devenv.lock found', async () => {
    const execSnapshots = mockExecAll();
    const res = await updateArtifacts({
      packageFileName: 'devenv.nix',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('content');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [''],
      }),
    );

    const res = await updateArtifacts({
      packageFileName: 'devenv.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateCmd }]);
  });

  it('returns updated devenv.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current devenv.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['devenv.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new devenv.lock');

    const res = await updateArtifacts({
      packageFileName: 'devenv.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'devenv.lock',
          contents: 'new devenv.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateCmd }]);
  });

  it('returns updated devenv.lock for lock file maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current devenv.lock');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['devenv.lock'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new devenv.lock');

    const res = await updateArtifacts({
      packageFileName: 'devenv.nix',
      updatedDeps: [],
      newPackageFileContent: '',
      config: { ...config, isLockFileMaintenance: true },
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'devenv.lock',
          contents: 'new devenv.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateCmd }]);
  });

  it('returns error on exec failure', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current devenv.lock');
    mockExecAll(new Error('exec failed'));

    const res = await updateArtifacts({
      packageFileName: 'devenv.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          lockFile: 'devenv.lock',
          stderr: 'exec failed',
        },
      },
    ]);
  });
});
