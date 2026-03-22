import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { env, fs, git, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import * as gomod from './index.ts';

type FS = typeof import('../../../util/fs/index.ts');

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/http/index.ts');
vi.mock('../../../util/fs/index.ts', async () => {
  return mockDeep({
    isValidLocalPath: (await vi.importActual<FS>('../../../util/fs'))
      .isValidLocalPath,
  });
});
vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('./artifacts-extra.ts', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const gomod1 = codeBlock`
  module github.com/renovate-tests/gomod1

  require github.com/pkg/errors v0.7.0

  replace github.com/pkg/errors => ../errors
`;

const adminConfig: RepoGlobalConfig = {
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

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  beforeEach(() => {
    delete process.env.GOPATH;
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    hostRules.clear();
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('adds tidy commands with correct relative paths from repo root', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi
        .fn()
        .mockResolvedValue(['api/go.mod', 'cmd/go.mod']),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'api/go.sum', 'cmd/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New cmd/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();
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

    // Verify tidy commands use correct relative paths (from repo root, goModDir is '')
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cmd: '(cd api && go mod tidy)',
        }),
        expect.objectContaining({
          cmd: '(cd cmd && go mod tidy)',
        }),
      ]),
    );
  });

  it('uses relative paths from subdirectory primary module', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('shared/vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi
        .fn()
        .mockResolvedValue(['api/go.mod', 'cmd/go.mod']),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['shared/go.sum', 'api/go.sum', 'cmd/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New cmd/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'shared/go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();

    // Verify tidy commands use relative paths FROM shared/ TO api/ and cmd/
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cmd: '(cd ../api && go mod tidy)',
        }),
        expect.objectContaining({
          cmd: '(cd ../cmd && go mod tidy)',
        }),
      ]),
    );
  });

  it('propagates tidyOpts to dependent module tidy commands', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi.fn().mockResolvedValue(['api/go.mod']),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'api/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy1.17', 'gomodTidyE'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();

    // Verify tidyOpts (-compat=1.17 -e) are included in dependent module commands
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cmd: '(cd api && go mod tidy -compat=1.17 -e)',
        }),
      ]),
    );
  });

  it('works together with gomodMassage - massages primary then tidies dependents', async () => {
    const gomodWithReplace = codeBlock`
      module github.com/renovate-tests/gomod1

      require github.com/pkg/errors v0.7.0

      replace github.com/pkg/errors => ../errors
    `;

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi.fn().mockResolvedValue(['api/go.mod']),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'go.mod', 'api/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    // Final go.mod read — simulates the massaged file on disk
    // with // renovate-replace prefix that gets stripped during un-massage
    fs.readLocalFile.mockResolvedValueOnce(
      gomodWithReplace.replace(
        'replace github.com/pkg/errors => ../errors',
        '// renovate-replace replace github.com/pkg/errors => ../errors',
      ),
    );

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodMassage', 'gomodTidyAll'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomodWithReplace,
      config,
    });

    expect(result).not.toBeNull();

    // Verify execution order: go get first, then primary tidy, then dependent tidy
    const cmds = execSnapshots.map((s) => s.cmd);
    const goGetIdx = cmds.findIndex((c) =>
      typeof c === 'string' ? c.startsWith('go get') : false,
    );
    const primaryTidyIdx = cmds.findIndex((c) => c === 'go mod tidy');
    const depTidyIdx = cmds.findIndex((c) =>
      typeof c === 'string' ? c.includes('cd api') : false,
    );

    // go get runs first, then primary tidy, then dependent tidy
    expect(goGetIdx).toBeGreaterThanOrEqual(0);
    expect(primaryTidyIdx).toBeGreaterThan(goGetIdx);
    expect(depTidyIdx).toBeGreaterThan(primaryTidyIdx);

    // Verify the dependent tidy command runs after massage
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: '(cd api && go mod tidy)' }),
      ]),
    );
  });

  it('runs go mod tidy on primary module when gomodTidyAll is used alone without gomodTidy', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    const execSnapshots = mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi.fn().mockResolvedValue(['api/go.mod']),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum', 'api/go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    // gomodTidyAll WITHOUT gomodTidy — should still tidy the primary module
    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();

    // Verify primary module gets go mod tidy AND dependent gets subshell tidy
    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go mod tidy' }),
        expect.objectContaining({ cmd: '(cd api && go mod tidy)' }),
      ]),
    );
  });

  it('does not call package-tree when gomodTidyAll is not enabled', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    mockExecAll();

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].file!.path).toBe('go.sum');
  });

  it('handles gomodTidyAll with no dependent modules gracefully', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi.fn().mockResolvedValue([]),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].file!.path).toBe('go.sum');
  });

  it('collects updated go.mod from dependent modules when only go.mod changed', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi.fn().mockResolvedValue(['api/go.mod']),
    }));

    // Only dependent go.mod modified (no go.sum changes anywhere)
    // This exercises the gomodTidyAllModules.some() branch in hasAnyChanges
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['api/go.mod'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New api/go.mod');
    fs.readLocalFile.mockResolvedValueOnce(gomod1); // final primary go.mod read

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: expect.objectContaining({ path: 'api/go.mod' }),
        }),
      ]),
    );
  });

  it('continues gracefully when gomodTidyAll fails', async () => {
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    fs.readLocalFile.mockResolvedValueOnce(null); // vendor modules filename
    mockExecAll();

    vi.doMock('./package-tree.ts', () => ({
      getGoModulesInTidyOrder: vi
        .fn()
        .mockRejectedValue(new Error('graph build failed')),
    }));

    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['go.sum'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const config: UpdateArtifactsConfig = {
      constraints: { go: '1.21' },
      postUpdateOptions: ['gomodTidyAll', 'gomodTidy'],
    };

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].file!.path).toBe('go.sum');
  });
});
