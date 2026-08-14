import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import * as _datasource from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import * as gomod from './index.ts';
import * as _packageTree from './package-tree.ts';

type FS = typeof import('../../../util/fs/index.ts');

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/http/index.ts');
vi.mock('../../../util/fs/index.ts', async () => {
  return mockDeep({
    isValidLocalPath: (await vi.importActual<FS>('../../../util/fs/index.ts'))
      .isValidLocalPath,
  });
});
vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('./artifacts-extra.ts', () => mockDeep());
vi.mock('./package-tree.ts', () => ({ getGoModulesInTidyOrder: vi.fn() }));

const datasource = vi.mocked(_datasource);
const packageTree = vi.mocked(_packageTree);

process.env.CONTAINERBASE = 'true';

const gomod1 = codeBlock`
  module github.com/renovate-tests/gomod1

  require github.com/pkg/errors v0.7.0

  replace github.com/pkg/errors => ../errors
`;

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
};

const goEnv = {
  GONOSUMDB: '1',
  GOPROXY: 'proxy.example.com',
  GOPRIVATE: 'private.example.com/*',
  GONOPROXY: 'noproxy.example.com/*',
  GOINSECURE: 'insecure.example.com/*',
  CGO_ENABLED: '1',
};

function baseConfig(
  overrides: Partial<UpdateArtifactsConfig> = {},
): UpdateArtifactsConfig {
  return {
    constraints: { go: '1.21' },
    postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    ...overrides,
  };
}

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  beforeEach(() => {
    delete process.env.GOPATH;
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
    datasource.getPkgReleases.mockResolvedValue({
      releases: [{ version: '1.21.0' }],
    });
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules.txt
  });

  it('emits subshell tidy commands with correct relative dirs, tidyOpts, and returns dependent sum files', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce([
      'api/go.mod',
      'cmd/go.mod',
    ]);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['shared/go.sum', 'api/go.sum', 'cmd/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New cmd/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const result = await gomod.updateArtifacts({
      packageFileName: 'shared/go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({
        postUpdateOptions: ['gomodTidyAll', 'gomodTidy1.17', 'gomodTidyE'],
      }),
    });

    // Relative paths from shared/ and tidyOpts propagation in one shot.
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cmd: 'go -C ../api mod tidy -compat=1.17 -e',
        }),
        expect.objectContaining({
          cmd: 'go -C ../cmd mod tidy -compat=1.17 -e',
        }),
      ]),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: expect.objectContaining({ path: 'api/go.sum' }),
        }),
        expect.objectContaining({
          file: expect.objectContaining({ path: 'cmd/go.sum' }),
        }),
      ]),
    );
  });

  it('implies primary tidy when only gomodTidyAll is set', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce(['api/go.mod']);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum', 'api/go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({ postUpdateOptions: ['gomodTidyAll'] }),
    });

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy' }),
        expect.objectContaining({ cmd: 'go -C api mod tidy' }),
      ]),
    );
  });

  it('collects updated dependent go.mod when only that file changed', async () => {
    mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce(['api/go.mod']);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['api/go.mod'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New api/go.mod');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: expect.objectContaining({ path: 'api/go.mod' }),
        }),
      ]),
    );
  });

  it('is a no-op when no dependents are found', async () => {
    mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce([]);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(result).toHaveLength(1);
    expect(result![0].file!.path).toBe('go.sum');
  });

  it('continues when dependent-module resolution throws', async () => {
    mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockRejectedValueOnce(
      new Error('graph build failed'),
    );
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(result).toHaveLength(1);
    expect(result![0].file!.path).toBe('go.sum');
  });

  it('does not consult package-tree when gomodTidyAll is disabled', async () => {
    mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({ postUpdateOptions: ['gomodTidy'] }),
    });

    expect(packageTree.getGoModulesInTidyOrder).not.toHaveBeenCalled();
  });
});
