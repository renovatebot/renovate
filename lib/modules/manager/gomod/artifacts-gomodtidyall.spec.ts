import { isString } from '@sindresorhus/is';
import { codeBlock } from 'common-tags';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { envMock, exec, mockExecAll } from '~test/exec-util.ts';
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
vi.mock('./package-tree.ts', () => ({ getGoModulesTidyPlan: vi.fn() }));

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

function mockTidyPlan(modules: string[], containsCycle = false): void {
  packageTree.getGoModulesTidyPlan.mockResolvedValueOnce({
    modules,
    containsCycle,
  });
}

function mockTidyFileContents(...passes: (string | null)[][]): void {
  for (const content of passes.flat()) {
    fs.readLocalFile.mockResolvedValueOnce(content);
  }
}

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  beforeEach(() => {
    vi.stubEnv('GOPATH', undefined);
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
    mockTidyPlan(['api/go.mod', 'cmd/go.mod']);
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
    mockTidyPlan(['api/go.mod']);
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

  it('skips the primary tidy for major updates without import path updates', async () => {
    const execSnapshots = mockExecAll();
    mockTidyPlan(['api/go.mod']);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['api/go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({
        updateType: 'major',
        postUpdateOptions: ['gomodTidyAll'],
      }),
    });

    expect(execSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cmd: 'go -C api mod tidy' }),
      ]),
    );
    expect(execSnapshots).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cmd: 'go mod tidy' })]),
    );
  });

  it('collects updated dependent go.mod when only that file changed', async () => {
    mockExecAll();
    mockTidyPlan(['api/go.mod']);
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
    mockTidyPlan([]);
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
    packageTree.getGoModulesTidyPlan.mockRejectedValueOnce(
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

    expect(packageTree.getGoModulesTidyPlan).not.toHaveBeenCalled();
  });

  it('stops resolving an already stable cycle and runs the normal pass', async () => {
    const execSnapshots = mockExecAll();
    mockTidyPlan(['api/go.mod'], true);
    const stableContents = ['root.mod', 'root.sum', 'api.mod', 'api.sum'];
    mockTidyFileContents(stableContents, stableContents);
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
      config: baseConfig(),
    });

    expect(
      execSnapshots.filter(({ cmd }) => cmd === 'go -C api mod tidy'),
    ).toHaveLength(2);
  });

  it.each([2, 3])(
    'resolves cyclic module tidies when pass %s stabilizes',
    async (passes) => {
      const execSnapshots = mockExecAll();
      mockTidyPlan(['api/go.mod'], true);
      const initialContents = ['root-0', 'sum-0', 'api-0', 'api-sum-0'];
      const stableContents = ['root-1', 'sum-1', 'api-1', 'api-sum-1'];
      mockTidyFileContents(
        initialContents,
        ...(passes === 3
          ? [
              [
                'root-intermediate',
                'sum-intermediate',
                'api-intermediate',
                'api-sum-intermediate',
              ],
            ]
          : []),
        stableContents,
        stableContents,
      );
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
        config: baseConfig(),
      });

      expect(
        execSnapshots.filter(({ cmd }) => cmd === 'go -C api mod tidy'),
      ).toHaveLength(passes + 1);
      expect(
        execSnapshots.filter(({ cmd }) => cmd === 'go mod tidy'),
      ).toHaveLength(passes + 2);
    },
  );

  it('never retries a skipped primary tidy for a major update', async () => {
    const execSnapshots = mockExecAll();
    mockTidyPlan(['api/go.mod'], true);
    const initialContents = ['root-0', 'sum-0', 'api-0', 'api-sum-0'];
    const stableContents = ['root-1', 'sum-1', 'api-1', 'api-sum-1'];
    mockTidyFileContents(initialContents, stableContents, stableContents);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['api/go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New api/go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({
        updateType: 'major',
        postUpdateOptions: ['gomodTidyAll'],
      }),
    });

    expect(
      execSnapshots.filter(({ cmd }) => cmd === 'go -C api mod tidy'),
    ).toHaveLength(3);
    expect(execSnapshots.some(({ cmd }) => cmd === 'go mod tidy')).toBeFalse();
  });

  it('runs the normal workspace vendor sequence and generation once after convergence', async () => {
    GlobalConfig.set({
      ...adminConfig,
      allowedUnsafeExecutions: ['goGenerate'],
    });
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('go.work');
    fs.readLocalFile.mockReset();
    fs.readLocalFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll();
    mockTidyPlan(['api/go.mod'], true);
    const initialContents = ['root-0', 'sum-0', 'api-0', 'api-sum-0'];
    const stableContents = ['root-1', 'sum-1', 'api-1', 'api-sum-1'];
    mockTidyFileContents(initialContents, stableContents, stableContents);
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New go.sum');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig({
        postUpdateOptions: ['gomodTidyAll', 'gomodVendor', 'goGenerate'],
      }),
    });

    expect(
      execSnapshots
        .map(({ cmd }) => cmd)
        .filter((cmd) => cmd.startsWith('go ')),
    ).toEqual([
      'go get -t ./...',
      'go mod tidy',
      'go -C api mod tidy',
      'go mod tidy',
      'go -C api mod tidy',
      'go mod tidy',
      'go work vendor',
      'go work sync',
      'go mod tidy',
      'go mod tidy',
      'go -C api mod tidy',
      'go generate ./...',
    ]);
  });

  it('restores all modules before the normal fallback pass when tidies do not stabilize', async () => {
    const execSnapshots = mockExecAll();
    mockTidyPlan(['api/go.mod'], true);
    mockTidyFileContents(
      ['root-0', 'sum-0', 'api-0', null],
      [gomod1, 'sum-1', 'api-1', 'api-sum-1'],
      ['root-2', 'sum-2', 'api-2', 'api-sum-2'],
      ['root-3', 'sum-3', 'api-3', 'api-sum-3'],
    );
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({ modified: ['go.sum'] }),
    );
    fs.readLocalFile.mockResolvedValueOnce('sum-1');
    fs.readLocalFile.mockResolvedValueOnce(gomod1);

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(
      execSnapshots.filter(({ cmd }) => cmd === 'go -C api mod tidy'),
    ).toHaveLength(4);
    expect(fs.writeLocalFile).toHaveBeenCalledWith('go.mod', 'root-0');
    expect(fs.writeLocalFile).toHaveBeenCalledWith('go.sum', 'sum-0');
    expect(fs.writeLocalFile).toHaveBeenCalledWith('api/go.mod', 'api-0');
    expect(fs.deleteLocalFile).toHaveBeenCalledWith('api/go.sum');
    expect(result).toEqual([
      {
        file: {
          type: 'addition',
          path: 'go.sum',
          contents: 'sum-1',
        },
      },
      {
        artifactError: {
          fileName: 'go.sum',
          stderr: 'go mod tidy did not stabilize after 3 passes',
        },
      },
    ]);
  });

  it('does not delete a module file after a failed snapshot read', async () => {
    mockExecAll();
    mockTidyPlan(['api/go.mod'], true);
    fs.readLocalFile.mockResolvedValueOnce(null);
    fs.localPathExists.mockResolvedValueOnce(true);

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(fs.deleteLocalFile).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        artifactError: {
          fileName: 'go.sum',
          stderr: 'Failed to read go.mod',
        },
      },
    ]);
  });

  it.each(['none', 'module', 'workspace'])(
    'produces only normal-pass artifacts after rollback with %s vendoring',
    async (vendoring) => {
      GlobalConfig.set({
        ...adminConfig,
        allowedUnsafeExecutions: ['goGenerate'],
      });
      mockTidyPlan(['api/go.mod'], true);
      const preparedMod = `${gomod1}\n// prepared by go get`;
      const fallbackMod = `${gomod1}\n// normal pass`;
      const files = new Map<string, string>([
        ['go.mod', gomod1],
        ['go.sum', 'original sum'],
        ['api/go.mod', 'original dependent'],
      ]);
      fs.readLocalFile.mockReset();
      fs.readLocalFile.mockImplementation((file) =>
        Promise.resolve(files.get(file) ?? null),
      );
      fs.writeLocalFile.mockImplementation((file, content) => {
        files.set(file, content.toString());
        return Promise.resolve();
      });
      fs.deleteLocalFile.mockImplementation((file) => {
        files.delete(file);
        return Promise.resolve();
      });
      fs.findLocalSiblingOrParent.mockReset();
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('vendor');
      fs.findLocalSiblingOrParent.mockResolvedValueOnce(
        vendoring === 'workspace' ? 'go.work' : null,
      );
      const commands: string[] = [];
      let sourceTidies = 0;
      let dependentTidies = 0;
      let fallbackContents: Map<string, string> | undefined;
      let sourceTidiesAtVendor: number | undefined;
      let dependentTidiesAtGenerate: number | undefined;
      exec.mockImplementation((command) => {
        const cmd = isString(command) ? command : command.command.join(' ');
        commands.push(cmd);
        if (cmd === 'go get -t ./...') {
          files.set('go.mod', preparedMod);
        } else if (cmd === 'go mod tidy') {
          sourceTidies += 1;
          if (sourceTidies === 4) {
            // The normal pass starts from the exact pre-resolution state,
            // including deleting a go.sum created by the speculative passes.
            fallbackContents = new Map(files);
          }
          files.set(
            'go.mod',
            sourceTidies <= 3 ? `trial ${sourceTidies}` : fallbackMod,
          );
          files.set(
            'go.sum',
            sourceTidies <= 3 ? `trial sum ${sourceTidies}` : 'normal sum',
          );
        } else if (cmd === 'go -C api mod tidy') {
          dependentTidies += 1;
          files.set(
            'api/go.mod',
            dependentTidies <= 3
              ? `trial dependent ${dependentTidies}`
              : 'normal dependent',
          );
          files.set(
            'api/go.sum',
            dependentTidies <= 3
              ? `trial dependent sum ${dependentTidies}`
              : 'normal dependent sum',
          );
        } else if (cmd === 'go mod vendor' || cmd === 'go work vendor') {
          sourceTidiesAtVendor = sourceTidies;
          files.set('vendor/modules.txt', files.get('go.mod')!);
        } else if (cmd === 'go work sync') {
          files.set('go.work.sum', 'normal workspace sum');
        } else if (cmd === 'go generate ./...') {
          dependentTidiesAtGenerate = dependentTidies;
          files.set('generated.go', files.get('api/go.mod')!);
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });
      git.getRepoStatus.mockImplementation(() =>
        Promise.resolve(
          partial<StatusResult>({
            modified: [...files.keys()],
            created: [],
            not_added: [],
            deleted: [],
          }),
        ),
      );

      const result = await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: baseConfig({
          postUpdateOptions: [
            'gomodTidyAll',
            'goGenerate',
            ...(vendoring === 'none' ? [] : ['gomodVendor' as const]),
          ],
        }),
      });

      expect(sourceTidies).toBe(vendoring === 'none' ? 5 : 6);
      expect(dependentTidies).toBe(4);
      expect(fallbackContents).toEqual(
        new Map([
          ['go.mod', preparedMod],
          ['go.sum', 'original sum'],
          ['api/go.mod', 'original dependent'],
        ]),
      );
      expect(sourceTidiesAtVendor).toBe(vendoring === 'none' ? undefined : 4);
      expect(dependentTidiesAtGenerate).toBe(4);
      expect(
        commands.filter((cmd) => cmd === 'go generate ./...'),
      ).toHaveLength(1);
      expect(result).toContainEqual({
        artifactError: {
          fileName: 'go.sum',
          stderr: 'go mod tidy did not stabilize after 3 passes',
        },
      });
      expect(result).toContainEqual({
        file: {
          type: 'addition',
          path: 'generated.go',
          contents: 'normal dependent',
        },
      });
      expect(result).toContainEqual({
        file: {
          type: 'addition',
          path: 'api/go.sum',
          contents: 'normal dependent sum',
        },
      });
      expect(
        result?.filter(({ file }) => file?.path === 'vendor/modules.txt'),
      ).toEqual(
        vendoring === 'none'
          ? []
          : [
              {
                file: {
                  type: 'addition',
                  path: 'vendor/modules.txt',
                  contents: fallbackMod,
                },
              },
            ],
      );
      expect(JSON.stringify(result)).not.toContain('trial');
      expect(
        [...files.values()].some((content) => content.includes('trial')),
      ).toBeFalse();
    },
  );

  it('restores speculative changes if a tidy command fails', async () => {
    mockTidyPlan(['api/go.mod'], true);
    mockTidyFileContents(['root-0', 'sum-0', 'api-0', null]);
    exec.mockImplementation((command) => {
      if (command === 'go -C api mod tidy') {
        throw new Error('tidy failed');
      }
      return Promise.resolve({ stdout: '', stderr: '' });
    });

    const result = await gomod.updateArtifacts({
      packageFileName: 'go.mod',
      updatedDeps: [],
      newPackageFileContent: gomod1,
      config: baseConfig(),
    });

    expect(fs.writeLocalFile).toHaveBeenCalledWith('go.mod', 'root-0');
    expect(fs.writeLocalFile).toHaveBeenCalledWith('go.sum', 'sum-0');
    expect(fs.writeLocalFile).toHaveBeenCalledWith('api/go.mod', 'api-0');
    expect(fs.deleteLocalFile).toHaveBeenCalledWith('api/go.sum');
    expect(result).toEqual([
      { artifactError: { fileName: 'go.sum', stderr: 'tidy failed' } },
    ]);
    expect(git.getRepoStatus).not.toHaveBeenCalled();
  });
});
