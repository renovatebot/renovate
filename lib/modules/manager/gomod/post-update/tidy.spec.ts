import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import * as docker from '../../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../../util/git/types.ts';
import type {
  BranchConfig,
  BranchUpgradeConfig,
} from '../../../../workers/types.ts';
import * as _packageTree from '../package-tree.ts';
import * as tidy from './tidy.ts';

type FS = typeof import('../../../../util/fs/index.ts');

vi.mock('../../../../util/exec/env.ts');
vi.mock('../../../../util/fs/index.ts', async () =>
  mockDeep({
    isValidLocalPath: (
      await vi.importActual<FS>('../../../../util/fs/index.ts')
    ).isValidLocalPath,
  }),
);
vi.mock('../package-tree.ts', () => ({
  getGoModulesInTidyOrder: vi.fn(),
}));

const packageTree = vi.mocked(_packageTree);

process.env.CONTAINERBASE = 'true';

const goModContent = codeBlock`
  module github.com/renovate-tests/gomod1

  go 1.21

  require github.com/pkg/errors v0.7.0
`;

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
  binarySource: 'global',
};

function baseConfig(overrides: Partial<BranchConfig> = {}): BranchConfig {
  return partial<BranchConfig>({
    manager: 'gomod',
    branchName: 'renovate/go-modules',
    baseBranch: 'main',
    constraints: { go: '1.21' },
    postUpdateOptions: ['gomodTidy'],
    upgrades: [
      partial<BranchUpgradeConfig>({
        manager: 'gomod',
        packageFile: 'shared/go.mod',
        depName: 'github.com/pkg/errors',
        updateType: 'minor',
      }),
    ],
    updatedPackageFiles: [
      { type: 'addition', path: 'shared/go.mod', contents: goModContent },
    ],
    updatedArtifacts: [],
    artifactErrors: [],
    ...overrides,
  });
}

function mockChangedFiles(paths: string[]): void {
  git.getRepoStatus.mockResolvedValueOnce(
    partial<StatusResult>({ modified: paths }),
  );
  fs.readLocalFile.mockImplementation((fileName) => {
    if (fileName.endsWith('.sum')) {
      return Promise.resolve(`Updated ${fileName}`);
    }
    if (fileName.endsWith('.mod')) {
      return Promise.resolve(goModContent);
    }
    return Promise.resolve(null);
  });
}

describe('modules/manager/gomod/post-update/tidy', () => {
  beforeEach(() => {
    vi.stubEnv('GOPATH', undefined);
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  afterEach(() => {
    GlobalConfig.reset();
    vi.unstubAllEnvs();
  });

  it('runs tidy for the root and dependent modules with tidy options', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce([
      'api/go.mod',
      'cmd/go.mod',
    ]);
    mockChangedFiles(['shared/go.sum', 'api/go.sum', 'cmd/go.sum']);

    const result = await tidy.executeGoModTidy(
      baseConfig({
        postUpdateOptions: ['gomodTidyAll', 'gomodTidy1.17', 'gomodTidyE'],
      }),
    );

    expect(packageTree.getGoModulesInTidyOrder).toHaveBeenCalledWith(
      'shared/go.mod',
    );
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy -compat=1.17 -e' }),
        expect.objectContaining({
          cmd: 'go -C ../api mod tidy -compat=1.17 -e',
        }),
        expect.objectContaining({
          cmd: 'go -C ../cmd mod tidy -compat=1.17 -e',
        }),
      ]),
    );
    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'shared/go.sum',
        }),
        expect.objectContaining({
          path: 'api/go.sum',
        }),
        expect.objectContaining({
          path: 'cmd/go.sum',
        }),
      ]),
    );
  });

  it('implies tidy of the root module when only gomodTidyAll is configured', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce(['api/go.mod']);
    mockChangedFiles(['shared/go.sum', 'api/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({ postUpdateOptions: ['gomodTidyAll'] }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy' }),
        expect.objectContaining({ cmd: 'go -C ../api mod tidy' }),
      ]),
    );
  });

  it('collects a dependent go.mod file when that is the only changed file', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce(['api/go.mod']);
    mockChangedFiles(['api/go.mod']);

    const result = await tidy.executeGoModTidy(
      baseConfig({ postUpdateOptions: ['gomodTidyAll'] }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy' }),
        expect.objectContaining({ cmd: 'go -C ../api mod tidy' }),
      ]),
    );
    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'api/go.mod',
        }),
      ]),
    );
  });

  it('returns no dependent artifacts when gomodTidyAll finds no dependents', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce([]);
    mockChangedFiles(['shared/go.sum']);

    const result = await tidy.executeGoModTidy(
      baseConfig({ postUpdateOptions: ['gomodTidyAll'] }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'shared/go.sum',
        }),
      ]),
    );
    expect(result.updatedArtifacts).toHaveLength(1);
  });

  it('does not consult the module graph when gomodTidyAll is disabled', async () => {
    const execSnapshots = mockExecAll();
    mockChangedFiles(['shared/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({ postUpdateOptions: ['gomodTidy'] }),
    );

    expect(packageTree.getGoModulesInTidyOrder).not.toHaveBeenCalled();
    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
  });

  it('does not run tidy for a major update unless import paths are updated', async () => {
    const execSnapshots = mockExecAll();
    mockChangedFiles(['shared/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({
        updateType: 'major',
        postUpdateOptions: ['gomodTidy'],
      }),
    );

    expect(execSnapshots).toBeEmptyArray();
    expect(packageTree.getGoModulesInTidyOrder).not.toHaveBeenCalled();
  });

  it('runs tidy for a major update when gomodUpdateImportPaths is enabled', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockResolvedValueOnce([]);
    mockChangedFiles(['shared/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({
        updateType: 'major',
        postUpdateOptions: ['gomodUpdateImportPaths'],
      }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
  });

  it('does not execute go commands when the module has no go.sum', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce(null);

    await tidy.executeGoModTidy(baseConfig());

    expect(execSnapshots).toBeEmptyArray();
  });

  it('continues when dependent-module resolution fails', async () => {
    const execSnapshots = mockExecAll();
    packageTree.getGoModulesInTidyOrder.mockRejectedValueOnce(
      new Error('graph build failed'),
    );
    mockChangedFiles(['shared/go.sum']);

    const result = await tidy.executeGoModTidy(
      baseConfig({ postUpdateOptions: ['gomodTidyAll'] }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'shared/go.sum',
        }),
      ]),
    );
  });

  it('uses -modcacherw when go version is unknown', async () => {
    const goModContentNoVersion = codeBlock`
    module github.com/renovate-tests/gomod1

    require github.com/pkg/errors v0.7.0
  `;
    const execSnapshots = mockExecAll();

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['shared/go.sum'] }),
    );

    fs.readLocalFile.mockImplementation((fileName) => {
      if (fileName.endsWith('.sum')) {
        return Promise.resolve(`Updated ${fileName}`);
      }
      if (fileName.endsWith('.mod')) {
        return Promise.resolve(goModContentNoVersion);
      }
      return Promise.resolve(null);
    });

    await tidy.executeGoModTidy(
      baseConfig({
        constraints: {},
      }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            env: expect.objectContaining({
              GOFLAGS: '-modcacherw',
            }),
          }),
        }),
      ]),
    );
  });

  it('skips upgrades without a package file', async () => {
    const execSnapshots = mockExecAll();

    await tidy.executeGoModTidy(
      baseConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: undefined,
            depName: 'github.com/pkg/errors',
            updateType: 'minor',
          }),
        ],
      }),
    );

    expect(execSnapshots).toBeEmptyArray();
    expect(git.getRepoStatus).not.toHaveBeenCalled();
  });

  it('finds go.mod when package file does not end in .mod', async () => {
    const execSnapshots = mockExecAll();

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('shared/go.mod');
    mockChangedFiles(['shared/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: 'shared/go.work',
            depName: 'github.com/pkg/errors',
            updateType: 'minor',
          }),
        ],
      }),
    );

    expect(fs.findLocalSiblingOrParent).toHaveBeenCalledWith(
      'shared/go.work',
      'go.mod',
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
  });

  it('returns early when no Go modules are found', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);

    const result = await tidy.executeGoModTidy(
      baseConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: 'shared/go.work',
            depName: 'github.com/pkg/errors',
            updateType: 'minor',
          }),
        ],
      }),
    );

    expect(fs.findLocalSiblingOrParent).toHaveBeenCalledWith(
      'shared/go.work',
      'go.mod',
    );

    expect(result).toEqual({
      updatedArtifacts: [],
      artifactErrors: [],
    });

    expect(git.getRepoStatus).not.toHaveBeenCalled();
  });

  it('collects go.work.sum when a go.work file exists', async () => {
    const execSnapshots = mockExecAll();

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('shared/go.work');

    mockChangedFiles(['shared/go.sum', 'shared/go.work.sum']);

    const result = await tidy.executeGoModTidy(baseConfig());

    expect(fs.findLocalSiblingOrParent).toHaveBeenCalledWith(
      'shared/go.mod',
      'go.work',
    );

    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'shared/go.sum',
        }),
        expect.objectContaining({
          path: 'shared/go.work.sum',
        }),
      ]),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
  });

  it('skips tidy when go.mod content cannot be read', async () => {
    const execSnapshots = mockExecAll();

    mockChangedFiles(['shared/go.sum']);

    fs.readLocalFile.mockImplementation((fileName) => {
      if (fileName.endsWith('.sum')) {
        return Promise.resolve(`Updated ${fileName}`);
      }

      if (fileName.endsWith('.mod')) {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });

    const result = await tidy.executeGoModTidy(baseConfig());

    expect(execSnapshots).toBeEmptyArray();
    expect(result.artifactErrors).toBeEmptyArray();
    expect(result.updatedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'shared/go.sum' }),
      ]),
    );
  });

  it('omits -modcacherw and sets CGO_ENABLED=0 when appropriate', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    const execSnapshots = mockExecAll();

    const goModContentOld = codeBlock`
      module github.com/renovate-tests/gomod1

      go 1.13

      require github.com/pkg/errors v0.7.0
    `;

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['shared/go.sum'] }),
    );

    fs.readLocalFile.mockImplementation((fileName) => {
      if (fileName.endsWith('.sum')) {
        return Promise.resolve(`Updated ${fileName}`);
      }
      if (fileName.endsWith('.mod')) {
        return Promise.resolve(goModContentOld);
      }
      return Promise.resolve(null);
    });

    await tidy.executeGoModTidy(
      baseConfig({
        constraints: { go: '1.13.0' },
      }),
    );

    const dockerRun = execSnapshots.find(({ cmd }) =>
      cmd.startsWith('docker run'),
    );

    expect(dockerRun).toBeDefined();
    expect(dockerRun?.cmd).toContain('-e CGO_ENABLED');
    expect(dockerRun?.cmd).not.toContain('-e GOFLAGS');
  });

  it('uses -modfile for Go modules with a custom filename', async () => {
    const execSnapshots = mockExecAll();

    fs.readLocalFile.mockImplementation((fileName) => {
      if (fileName.endsWith('.sum')) {
        return Promise.resolve(`Updated ${fileName}`);
      }
      if (fileName.endsWith('.mod')) {
        return Promise.resolve(goModContent);
      }
      return Promise.resolve(null);
    });

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['shared/custom.sum'] }),
    );

    await tidy.executeGoModTidy(
      baseConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: 'shared/custom.mod',
            depName: 'github.com/pkg/errors',
            updateType: 'minor',
          }),
        ],
      }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cmd: 'go mod tidy -modfile=custom.mod',
        }),
      ]),
    );
  });

  it('skips primary modules and dependent modules that were already scheduled', async () => {
    const execSnapshots = mockExecAll();

    packageTree.getGoModulesInTidyOrder
      .mockResolvedValueOnce(['api/go.mod', 'cmd/go.mod'])
      .mockResolvedValueOnce(['cmd/go.mod']);

    mockChangedFiles(['shared/go.sum', 'api/go.sum', 'cmd/go.sum']);

    await tidy.executeGoModTidy(
      baseConfig({
        postUpdateOptions: ['gomodTidyAll'],
        upgrades: [
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: 'shared/go.mod',
            depName: 'github.com/pkg/errors',
            updateType: 'minor',
          }),
          partial<BranchUpgradeConfig>({
            manager: 'gomod',
            packageFile: 'api/go.mod',
            depName: 'github.com/example/api',
            updateType: 'minor',
          }),
        ],
      }),
    );

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy' }),
        expect.objectContaining({
          cmd: 'go -C ../cmd mod tidy',
        }),
      ]),
    );

    expect(
      execSnapshots.filter(({ cmd }) => cmd === 'go -C ../cmd mod tidy'),
    ).toHaveLength(1);

    expect(
      execSnapshots.some(({ cmd }) => cmd === 'go -C ../api mod tidy'),
    ).toBe(false);
  });

  it('records an artifact error when go mod tidy fails', async () => {
    mockExecAll(new Error('go mod tidy failed'));

    mockChangedFiles([]);

    const result = await tidy.executeGoModTidy(baseConfig());

    expect(result.artifactErrors).toEqual([
      {
        fileName: 'shared/go.sum',
        stderr: 'go mod tidy failed',
      },
    ]);

    expect(result.updatedArtifacts).toEqual([]);
  });

  it('rethrows temporary errors from go mod tidy', async () => {
    mockExecAll(new Error(TEMPORARY_ERROR));
    mockChangedFiles(['shared/go.sum']);

    await expect(tidy.executeGoModTidy(baseConfig())).rejects.toThrow(
      TEMPORARY_ERROR,
    );
  });
});
