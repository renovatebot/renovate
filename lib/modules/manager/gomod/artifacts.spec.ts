import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { PlatformId } from '../../../constants/platforms';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as _hostRules from '../../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import * as gomod from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules');
jest.mock('../../../util/http');
jest.mock('../../../util/fs');

process.env.BUILDPACK = 'true';

const hostRules = mocked(_hostRules);

const gomod1 = `module github.com/renovate-tests/gomod1

require github.com/pkg/errors v0.7.0
require github.com/aws/aws-sdk-go v1.15.21
require github.com/davecgh/go-spew v1.0.0
require golang.org/x/foo v1.0.0
require github.com/rarkins/foo abcdef1
require gopkg.in/russross/blackfriday.v1 v1.0.0
require go.uber.org/zap v1.20.0

replace github.com/pkg/errors => ../errors

replace (golang.org/x/foo => github.com/pravesht/gocql v0.0.0)

replace (
  // TODO: this comment breaks renovatebot (>v0.11.1)
  go.uber.org/zap => go.uber.org/zap v1.21.0
)

`;

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {
  constraints: { go: '1.14' },
  postUpdateOptions: ['gomodMassage'],
};

const goEnv = {
  GONOSUMDB: '1',
  GOPROXY: 'proxy.example.com',
  GOPRIVATE: 'private.example.com/*',
  GONOPROXY: 'noproxy.example.com/*',
  GOINSECURE: 'insecure.example.com/*',
  CGO_ENABLED: '1',
};

describe('modules/manager/gomod/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    delete process.env.GOPATH;
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.getAll.mockReturnValue([]);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('returns if no go.sum found', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [] as string[],
    } as StatusResult);

    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CGO_ENABLED: '1',
            GOFLAGS: '-modcacherw',
            GOINSECURE: 'insecure.example.com/*',
            GONOPROXY: 'noproxy.example.com/*',
            GONOSUMDB: '1',
            GOPRIVATE: 'private.example.com/*',
            GOPROXY: 'proxy.example.com',
          },
        },
      },
    ]);
  });

  it('returns updated go.sum', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            CGO_ENABLED: '1',
            GOFLAGS: '-modcacherw',
            GOINSECURE: 'insecure.example.com/*',
            GONOPROXY: 'noproxy.example.com/*',
            GONOSUMDB: '1',
            GOPRIVATE: 'private.example.com/*',
            GOPROXY: 'proxy.example.com',
          },
        },
      },
    ]);
  });

  it('supports vendor directory update', async () => {
    const foo = join('vendor/github.com/foo/foo/go.mod');
    const bar = join('vendor/github.com/bar/bar/go.mod');
    const baz = join('vendor/github.com/baz/baz/go.mod');

    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce('modules.txt content'); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', foo],
      not_added: [bar],
      deleted: [baz],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('Foo go.sum');
    fs.readLocalFile.mockResolvedValueOnce('Bar go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: {
        ...config,
        postUpdateOptions: ['gomodTidy'],
      },
    });
    expect(res).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
      {
        file: {
          contents: 'Foo go.sum',
          path: 'vendor/github.com/foo/foo/go.mod',
          type: 'addition',
        },
      },
      {
        file: {
          contents: 'Bar go.sum',
          path: 'vendor/github.com/bar/bar/go.mod',
          type: 'addition',
        },
      },
      {
        file: {
          path: 'vendor/github.com/baz/baz/go.mod',
          type: 'deletion',
        },
      },
      {
        file: {
          contents: 'New go.mod',
          path: 'go.mod',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod vendor',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode without credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/go:latest' },
      { cmd: 'docker ps --filter name=renovate_go -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_go --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/go:latest' +
          ' bash -l -c "' +
          'go get -d -t ./...' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('supports install mode without credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
          },
        },
      },
    ]);
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode with credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        hostType: PlatformId.Github,
        matchHost: 'api.github.com',
      },
      { token: 'some-other-token', matchHost: 'https://gitea.com' },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/go:latest' },
      { cmd: 'docker ps --filter name=renovate_go -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_go --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
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
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/go:latest' +
          ' bash -l -c "' +
          'go get -d -t ./...' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
            BUILDPACK_CACHE_DIR: '/tmp/renovate/cache/containerbase',
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

  it('supports docker mode with 2 credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        hostType: PlatformId.Github,
        matchHost: 'api.github.com',
      },
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
        hostType: PlatformId.Github,
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/go:latest' },
      { cmd: 'docker ps --filter name=renovate_go -aq' },
      {
        options: {
          env: {
            GIT_CONFIG_COUNT: '6',
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
            GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
            GIT_CONFIG_VALUE_1: 'git@github.com:',
            GIT_CONFIG_VALUE_2: 'https://github.com/',
            GIT_CONFIG_VALUE_3: 'ssh://git@github.enterprise.com/',
            GIT_CONFIG_VALUE_4: 'git@github.enterprise.com:',
            GIT_CONFIG_VALUE_5: 'https://github.enterprise.com/',
          },
        },
      },
    ]);
  });

  it('supports docker mode with single credential', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token',
        matchHost: 'gitlab.enterprise.com',
        hostType: PlatformId.Gitlab,
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
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
                'url.https://gitlab-ci-token:some-enterprise-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://gitlab-ci-token:some-enterprise-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_2:
                'url.https://gitlab-ci-token:some-enterprise-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.enterprise.com/',
              GIT_CONFIG_VALUE_1: 'git@gitlab.enterprise.com:',
              GIT_CONFIG_VALUE_2: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with multiple credentials for different paths', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token-repo1',
        matchHost: 'https://gitlab.enterprise.com/repo1',
        hostType: PlatformId.Gitlab,
      },
      {
        token: 'some-enterprise-token-repo2',
        matchHost: 'https://gitlab.enterprise.com/repo2',
        hostType: PlatformId.Gitlab,
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
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
                'url.https://gitlab-ci-token:some-enterprise-token-repo1@gitlab.enterprise.com/repo1.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://gitlab-ci-token:some-enterprise-token-repo1@gitlab.enterprise.com/repo1.insteadOf',
              GIT_CONFIG_KEY_2:
                'url.https://gitlab-ci-token:some-enterprise-token-repo1@gitlab.enterprise.com/repo1.insteadOf',
              GIT_CONFIG_KEY_3:
                'url.https://gitlab-ci-token:some-enterprise-token-repo2@gitlab.enterprise.com/repo2.insteadOf',
              GIT_CONFIG_KEY_4:
                'url.https://gitlab-ci-token:some-enterprise-token-repo2@gitlab.enterprise.com/repo2.insteadOf',
              GIT_CONFIG_KEY_5:
                'url.https://gitlab-ci-token:some-enterprise-token-repo2@gitlab.enterprise.com/repo2.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.enterprise.com/repo1',
              GIT_CONFIG_VALUE_1: 'git@gitlab.enterprise.com:repo1',
              GIT_CONFIG_VALUE_2: 'https://gitlab.enterprise.com/repo1',
              GIT_CONFIG_VALUE_3: 'ssh://git@gitlab.enterprise.com/repo2',
              GIT_CONFIG_VALUE_4: 'git@gitlab.enterprise.com:repo2',
              GIT_CONFIG_VALUE_5: 'https://gitlab.enterprise.com/repo2',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode and ignores non http credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'ssh://github.enterprise.com',
        hostType: PlatformId.Github,
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
        hostType: PlatformId.Gitlab,
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
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
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_2:
                'url.https://gitlab-ci-token:some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.enterprise.com/',
              GIT_CONFIG_VALUE_1: 'git@gitlab.enterprise.com:',
              GIT_CONFIG_VALUE_2: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with many credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'api.github.com',
        hostType: PlatformId.Github,
      },
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
        hostType: PlatformId.Github,
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
        hostType: PlatformId.Gitlab,
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
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
              GIT_CONFIG_VALUE_8: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode and ignores non git credentials', async () => {
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
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    // TODO: #7154 can be null
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        file: {
          contents: 'New go.sum',
          path: 'go.sum',
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
      ])
    );
  });

  it('supports docker mode with goModTidy', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy'],
        },
      })
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/go:latest' },
      { cmd: 'docker ps --filter name=renovate_go -aq' },
      {
        cmd: 'docker run --rm --name=renovate_go --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e GOPROXY -e GOPRIVATE -e GONOPROXY -e GONOSUMDB -e GOINSECURE -e GOFLAGS -e CGO_ENABLED -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/go:latest bash -l -c "go get -d -t ./... && go mod tidy && go mod tidy"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode with gomodTidy1.17', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy1.17'],
        },
      })
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/go:latest' },
      { cmd: 'docker ps --filter name=renovate_go -aq' },
      {
        cmd: 'docker run --rm --name=renovate_go --label=renovate_child -v "/tmp/github/some/repo":"/tmp/github/some/repo" -v "/tmp/renovate/cache":"/tmp/renovate/cache" -e GOPROXY -e GOPRIVATE -e GONOPROXY -e GONOSUMDB -e GOINSECURE -e GOFLAGS -e CGO_ENABLED -e BUILDPACK_CACHE_DIR -w "/tmp/github/some/repo" renovate/go:latest bash -l -c "go get -d -t ./... && go mod tidy -compat=1.17 && go mod tidy -compat=1.17"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toEqual([
      {
        artifactError: {
          lockFile: 'go.sum',
          stderr: 'This update totally doesnt work',
        },
      },
    ]);
    expect(execSnapshots).toBeEmptyArray();
  });

  it('updates import paths with gomodUpdateImportPaths', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/google/go-github/v24' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      })
    ).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go install github.com/marwan-at-work/mod/cmd/mod@latest',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'mod upgrade --mod-name=github.com/google/go-github/v24 -t=28',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('skips updating import paths with gomodUpdateImportPaths on v0 to v1', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/pkg/errors' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 1,
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      })
    ).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('skips gomodTidy without gomodUpdateImportPaths on major update', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/google/go-github/v24' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
          postUpdateOptions: ['gomodTidy'],
        },
      })
    ).toEqual([
      { file: { contents: 'New go.sum', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New main.go', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('does not execute go mod tidy when none of gomodTidy and gomodUpdateImportPaths are set', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/google/go-github/v24' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
        },
      })
    ).toEqual([
      { file: { contents: 'New go.sum', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New main.go', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('updates import paths with specific tool version from constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/google/go-github/v24' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
          postUpdateOptions: ['gomodUpdateImportPaths'],
          constraints: {
            gomodMod: 'v1.2.3',
          },
        },
      })
    ).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go install github.com/marwan-at-work/mod/cmd/mod@v1.2.3',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'mod upgrade --mod-name=github.com/google/go-github/v24 -t=28',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('updates import paths with latest tool version on invalid version constraint', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'github.com/google/go-github/v24' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
          postUpdateOptions: ['gomodUpdateImportPaths'],
          constraints: {
            gomodMod: 'a.b.c',
          },
        },
      })
    ).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go install github.com/marwan-at-work/mod/cmd/mod@latest',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'mod upgrade --mod-name=github.com/google/go-github/v24 -t=28',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('skips updating import paths for gopkg.in dependencies', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [{ depName: 'gopkg.in/yaml.v2' }],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          newMajor: 28,
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      })
    ).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'go get -d -t ./...',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go mod tidy',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });
});
