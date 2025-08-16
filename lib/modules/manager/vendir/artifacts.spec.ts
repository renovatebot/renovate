import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { ExecError } from '../../../util/exec/exec-error';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import * as vendir from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { Fixtures } from '~test/fixtures';
import { env, fs, git, partial } from '~test/util';

process.env.CONTAINERBASE = 'true';

vi.mock('../../datasource', () => mockDeep());
vi.mock('../../../util/exec/env', () => mockDeep());
vi.mock('../../../util/http', () => mockDeep());
vi.mock('../../../util/fs', () => mockDeep());
vi.mock('../../../util/git', () => mockDeep());

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};
const vendirLockFile1 = Fixtures.get('vendir_1.lock');
const vendirLockFile2 = Fixtures.get('vendir_2.lock');
const vendirFile = Fixtures.get('vendir.yml');

describe('modules/manager/vendir/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no vendir.lock.yml found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if empty vendir.lock.yml found', async () => {
    const updatedDeps = [{ depName: 'dep1' }];
    fs.readLocalFile.mockResolvedValueOnce('');
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.lock.yml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce(vendirFile);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot([{ cmd: 'vendir sync' }]);
  });

  it('returns updated vendir.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'vendir sync' }]);
  });

  it('returns updated vendir.yml for lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps: [],
        newPackageFileContent: vendirFile,
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'vendir sync' }]);
  });

  it('catches errors', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      }),
    ).toEqual([
      {
        artifactError: {
          lockFile: 'vendir.yml',
          stderr: 'not found',
        },
      },
    ]);
  });

  it('rethrows for temporary error', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const execError = new ExecError(TEMPORARY_ERROR, {
      cmd: '',
      stdout: '',
      stderr: '',
      options: { encoding: 'utf8' },
    });
    const updatedDeps = [{ depName: 'dep1' }];
    mockExecAll(execError);
    await expect(
      vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('add artifacts to file list if vendir.yml exists', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // artifacts
    fs.getSiblingFileName.mockReturnValueOnce('vendor');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['vendor/Chart.yaml', 'vendor/my-chart/Chart.yaml'],
        deleted: ['vendor/removed.yaml'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    const test = await vendir.updateArtifacts({
      packageFileName: 'vendir.yml',
      updatedDeps,
      newPackageFileContent: vendirFile,
      config: {
        ...config,
      },
    });
    expect(test).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
      {
        file: {
          type: 'addition',
          path: 'vendor/Chart.yaml',
          contents: undefined,
        },
      },
      {
        file: {
          type: 'addition',
          path: 'vendor/my-chart/Chart.yaml',
          contents: undefined,
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'vendor/removed.yaml',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'vendir sync',
        options: {
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
        },
      },
    ]);
  });

  it('add artifacts', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    // artifacts
    fs.getSiblingFileName.mockReturnValueOnce('vendor');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['vendor/Chart.yaml'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          ...config,
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
      {
        file: {
          type: 'addition',
          path: 'vendor/Chart.yaml',
          contents: undefined,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'vendir sync',
        options: {
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
        },
      },
    ]);
  });

  it('works explicit global binarySource', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config,
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'vendir sync' }]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({
      ...adminConfig,
      binarySource: 'install',
    });
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');
    const updatedDeps = [{ depName: 'dep1' }];
    expect(
      await vendir.updateArtifacts({
        packageFileName: 'vendir.yml',
        updatedDeps,
        newPackageFileContent: vendirFile,
        config: {
          ...config,
          constraints: { vendir: '0.35.0', helm: '3.17.0' },
        },
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: 'vendir.lock.yml',
          contents: vendirLockFile2,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool vendir 0.35.0',
        options: {
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
        },
      },
      {
        cmd: 'install-tool helm 3.17.0',
        options: {
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
        },
      },
      {
        cmd: 'vendir sync',
        options: {
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
        },
      },
    ]);
  });

  describe('Docker', () => {
    beforeEach(() => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
      });
    });

    it('returns updated vendir.yml for lockfile maintenance', async () => {
      fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
      fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
      fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
      const execSnapshots = mockExecAll();
      fs.privateCacheDir.mockReturnValue(
        '/tmp/renovate/cache/__renovate-private-cache',
      );
      fs.getParentDir.mockReturnValue('');
      const updatedDeps = [{ depName: 'dep1' }];
      expect(
        await vendir.updateArtifacts({
          packageFileName: 'vendir.yml',
          updatedDeps,
          newPackageFileContent: vendirFile,
          config: {
            ...config,
            constraints: { vendir: '0.35.0', helm: '3.17.0' },
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'vendir.lock.yml',
            contents: vendirLockFile2,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
            '-v "/tmp/cache/containerbase":"/tmp/cache/containerbase" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar' +
            ' bash -l -c "' +
            'install-tool vendir 0.35.0' +
            ' && ' +
            'install-tool helm 3.17.0' +
            ' && ' +
            'vendir sync' +
            '"',
        },
      ]);
    });
  });
});
