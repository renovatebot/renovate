import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import * as vendir from './index.ts';

process.env.CONTAINERBASE = 'true';

vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('../../../util/exec/env.ts', () => mockDeep());
vi.mock('../../../util/http/index.ts', () => mockDeep());
vi.mock('../../../util/fs/index.ts', () => mockDeep());
vi.mock('../../../util/git/index.ts', () => mockDeep());

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'), // `join` fixes Windows CI
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
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

  afterEach(() => {
    hostRules.clear();
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
      options: {},
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

  it('sets GIT_CONFIG variables when Host Rules are configured', async () => {
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile1);
    fs.getSiblingFileName.mockReturnValueOnce('vendir.lock.yml');
    fs.readLocalFile.mockResolvedValueOnce(vendirLockFile2);
    const execSnapshots = mockExecAll();
    fs.privateCacheDir.mockReturnValue(
      '/tmp/renovate/cache/__renovate-private-cache',
    );
    fs.getParentDir.mockReturnValue('');

    hostRules.add({
      hostType: 'github',
      matchHost: 'api.github.com',
      token: 'some-token',
    });
    hostRules.add({
      hostType: 'github',
      matchHost: 'github.enterprise.com',
      token: 'some-enterprise-token',
    });
    hostRules.add({
      hostType: 'gitlab',
      matchHost: 'gitlab.enterprise.com',
      token: 'some-gitlab-token',
    });

    // artifacts
    fs.getSiblingFileName.mockReturnValueOnce('vendor');
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        not_added: ['vendor/Chart.yaml'],
      }),
    );
    const updatedDeps = [{ depName: 'dep1' }];

    await vendir.updateArtifacts({
      packageFileName: 'vendir.yml',
      updatedDeps,
      newPackageFileContent: vendirFile,
      config: {
        ...config,
      },
    });

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '9',
              GIT_CONFIG_KEY_0:
                'url.https://ssh:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://git:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_2: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_3:
                'url.https://ssh:some-enterprise-token@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_4:
                'url.https://git:some-enterprise-token@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_5:
                'url.https://some-enterprise-token@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_6:
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_7:
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_8:
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
              GIT_CONFIG_VALUE_1: 'git@github.com:',
              GIT_CONFIG_VALUE_2: 'https://github.com/',
              GIT_CONFIG_VALUE_3: 'ssh://git@github.enterprise.com/',
              GIT_CONFIG_VALUE_4: 'git@github.enterprise.com:',
              GIT_CONFIG_VALUE_5: 'https://github.enterprise.com/',
              GIT_CONFIG_VALUE_6: 'ssh://git@gitlab.enterprise.com/',
              GIT_CONFIG_VALUE_7: 'git@gitlab.enterprise.com:',
            }),
          }),
        }),
      ]),
    );
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
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
            '-v "/tmp/cache/containerbase":"/tmp/cache/containerbase" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image' +
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
