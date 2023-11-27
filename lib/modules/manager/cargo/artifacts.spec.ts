import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _hostRules from '../../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import * as cargo from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../../util/http');
jest.mock('../../../util/fs');

process.env.CONTAINERBASE = 'true';
const hostRules = mocked(_hostRules);
const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

describe('modules/manager/cargo/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.getAll.mockReturnValue([]);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns null if no Cargo.lock found', async () => {
    fs.statLocalFile.mockRejectedValue(new Error('not found!'));
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');

    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('updates Cargo.lock based on the packageName, when given', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'renamedDep1',
        packageName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated workspace Cargo.lock', async () => {
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/one/Cargo.lock not found'),
    );
    fs.statLocalFile.mockRejectedValueOnce(
      new Error('crates/Cargo.lock not found'),
    );
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);

    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'crates/one/Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated Cargo.lock for lockfile maintenance', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, updateType: 'lockFileMaintenance' },
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool rust 1.65.0' +
          ' && ' +
          'cargo update --config net.git-fetch-with-cli=true --manifest-path Cargo.toml --workspace' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('supports docker mode with credentials', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        hostType: 'github',
        matchHost: 'api.github.com',
      },
      { token: 'some-other-token', matchHost: 'https://gitea.com' },
    ]);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e GIT_CONFIG_KEY_0 ' +
          '-e GIT_CONFIG_VALUE_0 ' +
          '-e GIT_CONFIG_KEY_1 ' +
          '-e GIT_CONFIG_VALUE_1 ' +
          '-e GIT_CONFIG_KEY_2 ' +
          '-e GIT_CONFIG_VALUE_2 ' +
          '-e GIT_CONFIG_COUNT ' +
          '-e GIT_CONFIG_KEY_3 ' +
          '-e GIT_CONFIG_VALUE_3 ' +
          '-e GIT_CONFIG_KEY_4 ' +
          '-e GIT_CONFIG_VALUE_4 ' +
          '-e GIT_CONFIG_KEY_5 ' +
          '-e GIT_CONFIG_VALUE_5 ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool rust 1.65.0' +
          ' && ' +
          'cargo update --config net.git-fetch-with-cli=true --manifest-path Cargo.toml --workspace' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
            GIT_CONFIG_COUNT: '6',
            GIT_CONFIG_KEY_0:
              'url.https://ssh:some-token@github.com/.insteadOf',
            GIT_CONFIG_KEY_1:
              'url.https://git:some-token@github.com/.insteadOf',
            GIT_CONFIG_KEY_2: 'url.https://some-token@github.com/.insteadOf',
            GIT_CONFIG_KEY_3:
              'url.https://ssh:some-other-token@gitea.com/.insteadOf',
            GIT_CONFIG_KEY_4:
              'url.https://git:some-other-token@gitea.com/.insteadOf',
            GIT_CONFIG_KEY_5:
              'url.https://some-other-token@gitea.com/.insteadOf',
            GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
            GIT_CONFIG_VALUE_1: 'git@github.com:',
            GIT_CONFIG_VALUE_2: 'https://github.com/',
            GIT_CONFIG_VALUE_3: 'ssh://git@gitea.com/',
            GIT_CONFIG_VALUE_4: 'git@gitea.com:',
            GIT_CONFIG_VALUE_5: 'https://gitea.com/',
          },
        },
      },
    ]);
  });

  it('supports docker mode with many credentials', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'api.github.com',
        hostType: 'github',
      },
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
        hostType: 'github',
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
        hostType: 'gitlab',
      },
    ]);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
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

  it('supports docker mode and ignores non git credentials', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
        hostType: 'npm',
      },
    ]);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '3',
              GIT_CONFIG_KEY_0:
                'url.https://ssh:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://git:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_2: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
              GIT_CONFIG_VALUE_1: 'git@github.com:',
              GIT_CONFIG_VALUE_2: 'https://github.com/',
            }),
          }),
        }),
      ]),
    );
  });

  it('supports docker mode with Cargo specific credential', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token-cargo',
        matchHost: 'github.enterprise.com',
        hostType: 'cargo',
      },
    ]);
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '6',
              GIT_CONFIG_KEY_0:
                'url.https://ssh:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://git:some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_2: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_3:
                'url.https://ssh:some-enterprise-token-cargo@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_4:
                'url.https://git:some-enterprise-token-cargo@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_5:
                'url.https://some-enterprise-token-cargo@github.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
              GIT_CONFIG_VALUE_1: 'git@github.com:',
              GIT_CONFIG_VALUE_2: 'https://github.com/',
              GIT_CONFIG_VALUE_3: 'ssh://git@github.enterprise.com/',
              GIT_CONFIG_VALUE_4: 'git@github.enterprise.com:',
              GIT_CONFIG_VALUE_5: 'https://github.enterprise.com/',
            }),
          }),
        }),
      ]),
    );
  });

  it('supports install mode', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    git.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execSnapshots = mockExecAll();
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: { ...config, constraints: { rust: '1.65.0' } },
      }),
    ).toEqual([
      {
        file: {
          contents: undefined,
          path: 'Cargo.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool rust 1.65.0',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
      {
        cmd: 'cargo update --config net.git-fetch-with-cli=true --manifest-path Cargo.toml --workspace',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('catches errors', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: 'Cargo.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('Cargo.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current Cargo.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
      },
    ];
    expect(
      await cargo.updateArtifacts({
        packageFileName: 'Cargo.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      { artifactError: { lockFile: 'Cargo.lock', stderr: 'not found' } },
    ]);
  });
});
