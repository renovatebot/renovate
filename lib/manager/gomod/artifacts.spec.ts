import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import type { StatusResult } from '../../util/git';
import * as _hostRules from '../../util/host-rules';
import type { UpdateArtifactsConfig } from '../types';
import * as gomod from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../util/host-rules');
jest.mock('../../util/http');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const hostRules = mocked(_hostRules);

const gomod1 = `module github.com/renovate-tests/gomod1

require github.com/pkg/errors v0.7.0
require github.com/aws/aws-sdk-go v1.15.21
require github.com/davecgh/go-spew v1.0.0
require golang.org/x/foo v1.0.0
require github.com/rarkins/foo abcdef1
require gopkg.in/russross/blackfriday.v1 v1.0.0

replace github.com/pkg/errors => ../errors
`;

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};

const config: UpdateArtifactsConfig = {
  constraints: { go: '1.14' },
};

const goEnv = {
  GONOSUMDB: '1',
  GOPROXY: 'proxy.example.com',
  GOPRIVATE: 'private.example.com/*',
  GONOPROXY: 'noproxy.example.com/*',
  CGO_ENABLED: '1',
};

describe('manager/gomod/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    delete process.env.GOPATH;
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    setGlobalConfig(adminConfig);
    docker.resetPrefetchedImages();
  });
  afterEach(() => {
    setGlobalConfig();
  });
  it('returns if no go.sum found', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as StatusResult);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated go.sum', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports vendor directory update', async () => {
    const foo = join('vendor/github.com/foo/foo/go.mod');
    const bar = join('vendor/github.com/bar/bar/go.mod');
    const baz = join('vendor/github.com/baz/baz/go.mod');

    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce('modules.txt content' as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', foo],
      not_added: [bar],
      deleted: [baz],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    fs.readFile.mockResolvedValueOnce('Foo go.sum' as any);
    fs.readFile.mockResolvedValueOnce('Bar go.sum' as any);
    fs.readFile.mockResolvedValueOnce('New go.mod' as any);
    const res = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: {
        ...config,
        postUpdateOptions: ['gomodTidy'],
      },
    });
    expect(res).not.toBeNull();
    expect(res?.map(({ file }) => file)).toEqual([
      { contents: 'New go.sum', name: 'go.sum' },
      { contents: 'Foo go.sum', name: foo },
      { contents: 'Bar go.sum', name: bar },
      { contents: baz, name: '|delete|' },
      { contents: 'New go.mod', name: 'go.mod' },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode without credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'global' });
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode with credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('supports docker mode with 2 credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
      },
    ]);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '2',
              GIT_CONFIG_KEY_0: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://some-enterprise-token@github.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://github.com/',
              GIT_CONFIG_VALUE_1: 'https://github.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with single credential', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token',
        matchHost: 'gitlab.enterprise.com',
      },
    ]);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '1',
              GIT_CONFIG_KEY_0:
                'url.https://some-enterprise-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with multiple credentials for different paths', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-enterprise-token-repo1',
        matchHost: 'https://gitlab.enterprise.com/repo1',
      },
      {
        token: 'some-enterprise-token-repo2',
        matchHost: 'https://gitlab.enterprise.com/repo2',
      },
    ]);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '2',
              GIT_CONFIG_KEY_0:
                'url.https://some-enterprise-token-repo1@gitlab.enterprise.com/repo1.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://some-enterprise-token-repo2@gitlab.enterprise.com/repo2.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://gitlab.enterprise.com/repo1',
              GIT_CONFIG_VALUE_1: 'https://gitlab.enterprise.com/repo2',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode and ignores non http credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'ssh://github.enterprise.com',
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
      },
    ]);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '1',
              GIT_CONFIG_KEY_0:
                'url.https://some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with many credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    hostRules.getAll.mockReturnValueOnce([
      {
        token: 'some-token',
        matchHost: 'api.github.com',
      },
      {
        token: 'some-enterprise-token',
        matchHost: 'github.enterprise.com',
      },
      {
        token: 'some-gitlab-token',
        matchHost: 'gitlab.enterprise.com',
      },
    ]);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '4',
              GIT_CONFIG_KEY_0: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_KEY_1:
                'url.https://some-token@api.github.com/.insteadOf',
              GIT_CONFIG_KEY_2:
                'url.https://some-enterprise-token@github.enterprise.com/.insteadOf',
              GIT_CONFIG_KEY_3:
                'url.https://some-gitlab-token@gitlab.enterprise.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://github.com/',
              GIT_CONFIG_VALUE_1: 'https://api.github.com/',
              GIT_CONFIG_VALUE_2: 'https://github.enterprise.com/',
              GIT_CONFIG_VALUE_3: 'https://gitlab.enterprise.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode and ignores non git credentials', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
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
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_COUNT: '1',
              GIT_CONFIG_KEY_0: 'url.https://some-token@github.com/.insteadOf',
              GIT_CONFIG_VALUE_0: 'https://github.com/',
            }),
          }),
        }),
      ])
    );
  });

  it('supports docker mode with goModTidy', async () => {
    setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
    hostRules.find.mockReturnValueOnce({});
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum 1' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 2' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 3' as any);
    fs.readFile.mockResolvedValueOnce('New go.mod' as any);
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
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    fs.outputFile.mockImplementationOnce(() => {
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
    expect(execSnapshots).toMatchSnapshot();
  });
  it('updates import paths with gomodUpdateImportPaths', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New main.go' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
      { file: { contents: 'New go.sum', name: 'go.sum' } },
      { file: { contents: 'New main.go', name: 'main.go' } },
      { file: { contents: 'New go.mod', name: 'go.mod' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('skips updating import paths with gomodUpdateImportPaths on v0 to v1', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
      { file: { contents: 'New go.sum', name: 'go.sum' } },
      { file: { contents: 'New go.mod', name: 'go.mod' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('skips gomodTidy without gomodUpdateImportPaths on major update', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New main.go' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('does not execute go mod tidy when none of gomodTidy and gomodUpdateImportPaths are set', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New main.go' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('updates import paths with specific tool version from constraint', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New main.go' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
      { file: { contents: 'New go.sum', name: 'go.sum' } },
      { file: { contents: 'New main.go', name: 'main.go' } },
      { file: { contents: 'New go.mod', name: 'go.mod' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('updates import paths with latest tool version on invalid version constraint', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum', 'main.go'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New main.go' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
      { file: { contents: 'New go.sum', name: 'go.sum' } },
      { file: { contents: 'New main.go', name: 'main.go' } },
      { file: { contents: 'New go.mod', name: 'go.mod' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('skips updating import paths for gopkg.in dependencies', async () => {
    fs.readFile.mockResolvedValueOnce('Current go.sum' as any);
    fs.readFile.mockResolvedValueOnce(null as any); // vendor modules filename
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile
      .mockResolvedValueOnce('New go.sum' as any)
      .mockResolvedValueOnce('New go.mod' as any);
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
      { file: { contents: 'New go.sum', name: 'go.sum' } },
      { file: { contents: 'New go.mod', name: 'go.mod' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
});
