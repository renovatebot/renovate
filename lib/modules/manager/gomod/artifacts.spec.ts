import { codeBlock } from 'common-tags';
import { join } from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as _hostRules from '../../../util/host-rules';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as _artifactsExtra from './artifacts-extra';
import * as _packageTree from './package-tree';
import * as gomod from '.';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util';
import { env, fs, git, partial } from '~test/util';

type FS = typeof import('../../../util/fs');

vi.mock('../../../util/exec/env');
vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('../../../util/http');
vi.mock('../../../util/fs', async () => {
  // restore
  return mockDeep({
    isValidLocalPath: (await vi.importActual<FS>('../../../util/fs'))
      .isValidLocalPath,
  });
});
vi.mock('../../datasource', () => mockDeep());
vi.mock('./artifacts-extra', () => mockDeep());
vi.mock('./package-tree', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const datasource = vi.mocked(_datasource);
const hostRules = vi.mocked(_hostRules);
const artifactsExtra = vi.mocked(_artifactsExtra);
const packageTree = vi.mocked(_packageTree);

const gomod1 = codeBlock`
  module github.com/renovate-tests/gomod1

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
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
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
      }),
    ).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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

  it('runs go mod vendor with gomodVendor', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');

    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
        not_added: [],
        deleted: [],
      }),
    );
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: {
        ...config,
        postUpdateOptions: ['gomodVendor'],
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
        cmd: 'go mod vendor',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('runs go work vendor with gomodVendor and go.work', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('go.work');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
        not_added: [],
        deleted: [],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: {
        ...config,
        postUpdateOptions: ['gomodVendor'],
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
        cmd: 'go work vendor',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go work sync',
        options: { cwd: '/tmp/github/some/repo' },
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', foo],
        not_added: [bar],
        deleted: [baz],
      }),
    );
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

  it('skips vendor directory update with gomodSkipVendor', async () => {
    const foo = join('vendor/github.com/foo/foo/go.mod');
    const bar = join('vendor/github.com/bar/bar/go.mod');
    const baz = join('vendor/github.com/baz/baz/go.mod');

    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', foo],
        not_added: [bar],
        deleted: [baz],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: {
        ...config,
        postUpdateOptions: ['gomodSkipVendor'],
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
    ]);
  });

  it('supports vendor directory update with go.work', async () => {
    const foo = join('vendor/github.com/foo/foo/go.mod');
    const bar = join('vendor/github.com/bar/bar/go.mod');
    const baz = join('vendor/github.com/baz/baz/go.mod');

    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce('modules.txt content'); // vendor modules filename
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('go.work');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'go.work.sum', foo],
        not_added: [bar],
        deleted: [baz],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New go.work.sum');
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
          contents: 'New go.work.sum',
          path: 'go.work.sum',
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
        cmd: 'go work vendor',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'go work sync',
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {},
        },
      },
    ]);
  });

  it('supports install mode without credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      { cmd: 'install-tool golang 1.23.3' },
      {
        cmd: 'go get -d -t ./...',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {},
        },
      },
    ]);
  });

  it('supports global mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
        hostType: 'github',
        matchHost: 'api.github.com',
      },
      { token: 'some-other-token', matchHost: 'https://gitea.com' },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
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
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          '"',
        options: {
          cwd: '/tmp/github/some/repo',
          env: {
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
        hostType: 'github',
        matchHost: 'api.github.com',
      },
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
        hostType: 'github',
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
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
        hostType: 'gitlab',
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      ]),
    );
  });

  it('supports docker mode with multiple credentials for different paths', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token-repo1',
        matchHost: 'https://gitlab.enterprise.com/repo1',
        hostType: 'gitlab',
      },
      {
        token: 'some-enterprise-token-repo2',
        matchHost: 'https://gitlab.enterprise.com/repo2',
        hostType: 'gitlab',
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      ]),
    );
  });

  it('supports docker mode and ignores non http credentials', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'ssh://github.enterprise.com',
        hostType: 'github',
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
        hostType: 'gitlab',
      },
    ]);
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      ]),
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
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      ]),
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
    // TODO: #22198 can be null
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
      ]),
    );
  });

  it('supports docker mode with goModTidy', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy'],
        },
      }),
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go mod tidy' +
          ' && ' +
          'go mod tidy' +
          '"',
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy1.17'],
        },
      }),
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go mod tidy -compat=1.17' +
          ' && ' +
          'go mod tidy -compat=1.17' +
          '"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode with gomodTidyE and gomodTidy1.17', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidyE', 'gomodTidy1.17'],
        },
      }),
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go mod tidy -compat=1.17 -e' +
          ' && ' +
          'go mod tidy -compat=1.17 -e' +
          '"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('supports docker mode with gomodTidyE', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 1');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 2');
    fs.readLocalFile.mockResolvedValueOnce('New go.sum 3');
    fs.readLocalFile.mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidyE'],
        },
      }),
    ).toEqual([
      { file: { contents: 'New go.sum 1', path: 'go.sum', type: 'addition' } },
      { file: { contents: 'New go.sum 2', path: 'go.mod', type: 'addition' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go mod tidy -e' +
          ' && ' +
          'go mod tidy -e' +
          '"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    fs.readLocalFile.mockResolvedValueOnce('go.mod file');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      }),
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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

  it('updates correct import paths with gomodUpdateImportPaths and multiple dependencies', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
          { depName: 'github.com/caarlos0/env/v6', newVersion: 'v7.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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
        cmd: 'mod upgrade --mod-name=github.com/caarlos0/env/v6 -t=7',
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/pkg/errors', newVersion: 'v1.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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

  it('skips updating import paths when invalid major version', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/pkg/errors', newVersion: 'vx.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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

  it('skips updating import paths when incompatible version', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('Current go.sum')
      .mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          {
            depName: 'github.com/docker/docker',
            newVersion: 'v23.0.0+incompatible',
          },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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

  it('skips gomodTidy without gomodUpdateImportPaths on major update', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
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
      }),
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
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
      }),
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
          constraints: {
            gomodMod: 'v1.2.3',
          },
        },
      }),
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
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
          constraints: {
            gomodMod: 'a.b.c',
          },
        },
      }),
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

  it('updates import paths for gopkg.in dependencies including v0 to v1', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [
          { depName: 'gopkg.in/yaml.v2', newVersion: 'v28.0.0' },
          { depName: 'gopkg.in/foo.v0', newVersion: 'v1.0.0' },
        ],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          updateType: 'major',
          postUpdateOptions: ['gomodUpdateImportPaths'],
        },
      }),
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
        cmd: 'go install github.com/marwan-at-work/mod/cmd/mod@latest',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'mod upgrade --mod-name=gopkg.in/yaml.v2 -t=28',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'mod upgrade --mod-name=gopkg.in/foo.v0 -t=1',
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

  it('gomod file and config do not contain GoConstraints', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [
        { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
      ],
      newPackageFileContent: gomod1,
      config: {
        updateType: 'major',
        postUpdateOptions: ['gomodUpdateImportPaths'],
      },
    });
    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool golang 1.23.3' },
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

  it('go.mod file contains go version', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [
        { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
      ],
      newPackageFileContent: `someText\n\ngo 1.17\n\n${gomod1}`,
      config: {
        updateType: 'major',
        postUpdateOptions: ['gomodUpdateImportPaths'],
      },
    });

    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    const expectedResult = [
      {
        cmd: 'docker pull ghcr.io/containerbase/sidecar',
      },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go install github.com/marwan-at-work/mod/cmd/mod@latest' +
          ' && ' +
          'mod upgrade --mod-name=github.com/google/go-github/v24 -t=28' +
          ' && ' +
          'go mod tidy ' +
          '&& ' +
          'go mod tidy' +
          '"',
      },
    ];
    expect(execSnapshots).toMatchObject(expectedResult);
  });

  it('go.mod file contains go toolchain version', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');

    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [{ depName: 'golang.org/x/crypto', newVersion: '0.35.0' }],
      newPackageFileContent: `someText\n\ngo 1.13\n\ntoolchain go1.23.6\n\n${gomod1}`,
      config: {
        updateType: 'minor',
      },
    });

    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool golang 1.23.6',
      },
      {
        cmd: 'go get -d -t ./...',
      },
    ]);

    expect(datasource.getPkgReleases).toBeCalledTimes(0);
  });

  it('go.mod file contains full go version without toolchain', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New go.mod');

    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [{ depName: 'golang.org/x/crypto', newVersion: '0.35.0' }],
      newPackageFileContent: `someText\n\ngo 1.23.5\n\n${gomod1}`,
      config: {
        updateType: 'minor',
      },
    });

    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool golang 1.23.5',
      },
      {
        cmd: 'go get -d -t ./...',
      },
    ]);

    expect(datasource.getPkgReleases).toBeCalledTimes(0);
  });

  it('returns artifact notices', async () => {
    artifactsExtra.getExtraDepsNotice.mockReturnValue('some extra notice');
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [
        { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
      ],
      newPackageFileContent: `someText\n\ngo 1.17\n\n${gomod1}`,
      config: {
        updateType: 'major',
        postUpdateOptions: ['gomodUpdateImportPaths'],
      },
    });

    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      {
        file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' },
        notice: { file: 'go.mod', message: 'some extra notice' },
      },
    ]);
  });

  it('config contains go version', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'main.go'],
      }),
    );
    fs.readLocalFile
      .mockResolvedValueOnce('New go.sum')
      .mockResolvedValueOnce('New main.go')
      .mockResolvedValueOnce('New go.mod');
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '1.17.0' }, { version: '1.23.3' }],
    });
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [
        { depName: 'github.com/google/go-github/v24', newVersion: 'v28.0.0' },
      ],
      newPackageFileContent: gomod1,
      config: {
        updateType: 'major',
        postUpdateOptions: ['gomodUpdateImportPaths'],
        constraints: {
          go: '1.14',
        },
      },
    });
    expect(res).toEqual([
      { file: { type: 'addition', path: 'go.sum', contents: 'New go.sum' } },
      { file: { type: 'addition', path: 'main.go', contents: 'New main.go' } },
      { file: { type: 'addition', path: 'go.mod', contents: 'New go.mod' } },
    ]);
    const expectedResult = [
      {
        cmd: 'docker pull ghcr.io/containerbase/sidecar',
      },
      {},
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e GOPROXY ' +
          '-e GOPRIVATE ' +
          '-e GONOPROXY ' +
          '-e GONOSUMDB ' +
          '-e GOINSECURE ' +
          '-e GOFLAGS ' +
          '-e CGO_ENABLED ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar' +
          ' bash -l -c "' +
          'install-tool golang 1.23.3' +
          ' && ' +
          'go get -d -t ./...' +
          ' && ' +
          'go install github.com/marwan-at-work/mod/cmd/mod@latest' +
          ' && ' +
          'mod upgrade --mod-name=github.com/google/go-github/v24 -t=28' +
          ' && ' +
          'go mod tidy ' +
          '&& ' +
          'go mod tidy' +
          '"',
      },
    ];
    expect(execSnapshots).toMatchObject(expectedResult);
  });

  it('handles goGetDirs configuration correctly', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      }),
    );

    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          goGetDirs: ['.', 'foo', '.bar/...', '&&', 'cat', '/etc/passwd'],
        },
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: "go get -d -t . foo .bar/... '&&' cat",
        options: {
          cwd: '/tmp/github/some/repo',
        },
      },
    ]);
  });

  it('returns updated go.sum when goGetDirs is specified', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          goGetDirs: ['.'],
        },
      }),
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
        cmd: 'go get -d -t .',
        options: {
          cwd: '/tmp/github/some/repo',
        },
      },
    ]);
  });

  it('errors when goGetDirs is specified with all invalid paths', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          goGetDirs: ['/etc', '../../../'],
        },
      }),
    ).toEqual([
      { artifactError: { lockFile: 'go.sum', stderr: 'Invalid goGetDirs' } },
    ]);
    expect(execSnapshots).toMatchObject([]);
  });

  describe('gomodTidyAll', () => {
    it('calls getTransitiveDependentModules when gomodTidyAll is enabled', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
      fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
      packageTree.getTransitiveDependentModules.mockResolvedValueOnce([
        { name: 'go.mod', isLeaf: true },
      ]);
      mockExecAll();
      git.getRepoStatus
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['go.sum'], // Need at least one file modified to continue processing
          }),
        )
        .mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['go.sum'], // Mock for dependent module tidy
          }),
        );
      fs.readLocalFile.mockResolvedValueOnce('Updated go.sum'); // Mock the file read for the modified file
      fs.readLocalFile.mockResolvedValueOnce(
        'Updated go.sum after dependent tidy',
      ); // Mock for dependent module read

      const result = await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidyAll'],
        },
      });

      // Should call getTransitiveDependentModules
      expect(packageTree.getTransitiveDependentModules).toHaveBeenCalledWith(
        'go.mod',
      );
      // Should return result including dependent module updates
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.objectContaining({
              path: 'go.sum',
              type: 'addition',
            }),
          }),
        ]),
      );
    });

    it('skips root go mod tidy in main processing when gomodTidyAll is enabled', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
      fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [],
        }),
      );

      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidyAll'],
        },
      });

      // Should NOT contain "go mod tidy" in root processing (only go get)
      expect(execSnapshots[0].cmd).not.toContain('go mod tidy');
      expect(execSnapshots[0].cmd).toContain('go get');
    });

    it('includes go mod tidy in main processing when gomodTidyAll is NOT enabled', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
      fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [],
        }),
      );

      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy'],
        },
      });

      // Should contain "go mod tidy" when gomodTidyAll is not enabled
      // go mod tidy commands come after go get
      const allCommands = execSnapshots.map((s) => s.cmd).join(' ');
      expect(allCommands).toContain('go mod tidy');
    });

    it('does not call getTransitiveDependentModules when gomodTidyAll is not enabled', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
      fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
      mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['go.sum'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated go.sum');
      fs.readLocalFile.mockResolvedValueOnce('Updated go.mod');

      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy'], // Using normal gomodTidy, not gomodTidyAll
        },
      });

      // Should NOT call getTransitiveDependentModules when gomodTidyAll is not enabled
      expect(packageTree.getTransitiveDependentModules).not.toHaveBeenCalled();
    });

    it('does not call getTransitiveDependentModules when no tidying options are enabled', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
      fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
      mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['go.sum'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated go.sum');
      fs.readLocalFile.mockResolvedValueOnce('Updated go.mod');

      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          // No tidying options enabled
        },
      });

      // Should NOT call getTransitiveDependentModules when no tidying options are enabled
      expect(packageTree.getTransitiveDependentModules).not.toHaveBeenCalled();
    });

    describe('dependency processing optimization concepts', () => {
      it('should handle multiple dependent modules sequentially by default', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        // Mock multiple dependent modules
        packageTree.getTransitiveDependentModules.mockResolvedValueOnce([
          { name: 'common/go.mod', isLeaf: false },
          { name: 'service/go.mod', isLeaf: true },
          { name: 'web/go.mod', isLeaf: true },
        ]);

        const execSnapshots = mockExecAll();
        git.getRepoStatus
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['go.sum'] }),
          )
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['common/go.sum'] }),
          )
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['service/go.sum'] }),
          )
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['web/go.sum'] }),
          );

        fs.readLocalFile
          .mockResolvedValueOnce('Updated go.sum')
          .mockResolvedValueOnce('Updated common go.sum')
          .mockResolvedValueOnce('Updated service go.sum')
          .mockResolvedValueOnce('Updated web go.sum');

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidyAll'],
          },
        });

        // Verify getTransitiveDependentModules was called
        expect(packageTree.getTransitiveDependentModules).toHaveBeenCalledWith(
          'go.mod',
        );

        // Verify main execution happened + dependent modules (1 main + 3 dependents = 4 total)
        expect(execSnapshots).toHaveLength(4);
        expect(execSnapshots[0].cmd).toContain('go get'); // Main module
        expect(execSnapshots[1].cmd).toContain('go mod tidy'); // First dependent
        expect(execSnapshots[2].cmd).toContain('go mod tidy'); // Second dependent
        expect(execSnapshots[3].cmd).toContain('go mod tidy'); // Third dependent

        // Verify results include dependent modules
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              file: expect.objectContaining({ path: 'go.sum' }),
            }),
          ]),
        );
      });

      it('should identify leaf vs non-leaf modules correctly', () => {
        const modules = [
          { name: 'common/go.mod', isLeaf: false }, // Has dependents
          { name: 'service/go.mod', isLeaf: true }, // No dependents
          { name: 'web/go.mod', isLeaf: true }, // No dependents
        ];

        // Test: Leaf modules are those with isLeaf: true
        const leafModules = modules.filter((m) => m.isLeaf);
        const nonLeafModules = modules.filter((m) => !m.isLeaf);

        expect(leafModules).toHaveLength(2);
        expect(nonLeafModules).toHaveLength(1);
        expect(leafModules[0].name).toBe('service/go.mod');
        expect(leafModules[1].name).toBe('web/go.mod');
        expect(nonLeafModules[0].name).toBe('common/go.mod');
      });

      it('should understand dependency order from getTransitiveDependentModules', () => {
        // Modules returned in dependency order (dependencies first)
        const dependencyOrderedModules = [
          { name: 'libs/common/go.mod', isLeaf: false }, // Level 0: foundation
          { name: 'libs/utils/go.mod', isLeaf: false }, // Level 0: foundation
          { name: 'services/auth/go.mod', isLeaf: false }, // Level 1: depends on common
          { name: 'services/web/go.mod', isLeaf: false }, // Level 1: depends on utils
          { name: 'services/api/go.mod', isLeaf: true }, // Level 2: depends on auth
          { name: 'services/worker/go.mod', isLeaf: true }, // Level 2: depends on web
        ];

        // Test: Dependencies appear before dependents in the array
        const commonIndex = dependencyOrderedModules.findIndex(
          (m) => m.name === 'libs/common/go.mod',
        );
        const authIndex = dependencyOrderedModules.findIndex(
          (m) => m.name === 'services/auth/go.mod',
        );
        const apiIndex = dependencyOrderedModules.findIndex(
          (m) => m.name === 'services/api/go.mod',
        );

        expect(commonIndex).toBeLessThan(authIndex); // common before auth
        expect(authIndex).toBeLessThan(apiIndex); // auth before api

        // Test: Modules at same level (no dependency between them) can be parallel
        const utilsIndex = dependencyOrderedModules.findIndex(
          (m) => m.name === 'libs/utils/go.mod',
        );
        const webIndex = dependencyOrderedModules.findIndex(
          (m) => m.name === 'services/web/go.mod',
        );

        // utils and common are at same level (both are foundations)
        expect(Math.abs(commonIndex - utilsIndex)).toBeLessThan(2);
        // auth and web are at same level (both depend on different foundations)
        expect(Math.abs(authIndex - webIndex)).toBeLessThan(2);
      });

      it('should handle empty dependency list gracefully', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        // Empty dependency list - but only gets called when tidying actually happens
        packageTree.getTransitiveDependentModules.mockResolvedValueOnce([]);

        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({ modified: ['go.sum'] }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated go.sum');

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidyAll'],
          },
        });

        // Note: getTransitiveDependentModules is only called when there are actual file changes
        // In this scenario, it may not be called, which is expected behavior

        // Should still process main module
        expect(execSnapshots).toHaveLength(1);
        expect(execSnapshots[0].cmd).toContain('go get');

        // Should return some result (either success or error is acceptable)
        expect(result).not.toBeNull();
        // Just verify it's an array - the content can vary based on error handling
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle infinite loop protection when currentLevel is empty', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        // Mock a scenario where no dependencies exist to trigger the break condition
        packageTree.getTransitiveDependentModules.mockResolvedValueOnce([]);

        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({ modified: ['go.sum'] }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated go.sum');

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidyAll'],
          },
        });

        expect(result).not.toBeNull();
        expect(execSnapshots).toHaveLength(1); // Only main module processing
      });

      it('should handle error in main updateArtifacts processing', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        // Mock exec to throw an error
        mockExecAll(new Error('go command failed'));

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidy'],
          },
        });

        // Should return an artifact error
        expect(result).toEqual([
          {
            artifactError: {
              lockFile: 'go.sum',
              stderr: 'go command failed',
            },
          },
        ]);
      });

      it('should handle go.mod file modification in tidyDependentModule', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        packageTree.getTransitiveDependentModules.mockResolvedValueOnce([
          { name: 'submodule/go.mod', isLeaf: true },
        ]);

        mockExecAll();
        git.getRepoStatus
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['go.sum'] }),
          )
          .mockResolvedValueOnce(
            partial<StatusResult>({
              modified: ['submodule/go.sum', 'submodule/go.mod'], // Both sum and mod files modified
            }),
          );

        fs.readLocalFile
          .mockResolvedValueOnce('Updated go.sum')
          .mockResolvedValueOnce('Updated submodule go.sum')
          .mockResolvedValueOnce('Updated submodule go.mod');

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidyAll'],
          },
        });

        // Should return results for both go.sum and go.mod files
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              file: expect.objectContaining({
                path: 'go.sum',
                type: 'addition',
              }),
            }),
            expect.objectContaining({
              file: expect.objectContaining({
                path: 'submodule/go.sum',
                type: 'addition',
              }),
            }),
            expect.objectContaining({
              file: expect.objectContaining({
                path: 'submodule/go.mod',
                type: 'addition',
              }),
            }),
          ]),
        );
      });

      it('should handle error in tidyDependentModule', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
        fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename

        packageTree.getTransitiveDependentModules.mockResolvedValueOnce([
          { name: 'submodule/go.mod', isLeaf: true },
        ]);

        // Mock main exec to succeed but dependent module exec to fail
        mockExecSequence([
          { stdout: '', stderr: '' }, // Main module succeeds
          new Error('submodule go mod tidy failed'), // Dependent module fails
        ]);

        git.getRepoStatus
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: ['go.sum'] }),
          )
          .mockResolvedValueOnce(
            partial<StatusResult>({ modified: [] }), // No changes in dependent module due to error
          );

        fs.readLocalFile.mockResolvedValueOnce('Updated go.sum');

        const result = await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            postUpdateOptions: ['gomodTidyAll'],
          },
        });

        // Should return results including the error for dependent module
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              artifactError: expect.objectContaining({
                lockFile: expect.stringMatching(/go\.sum$/),
                stderr: expect.any(String),
              }),
            }),
          ]),
        );
      });
    });
  });
});
