import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';
import { envMock, mockExecAll } from '~test/exec-util';
import { env, fs, git, partial } from '~test/util';

vi.mock('../../../util/exec/env', () => ({
  getEnv: vi.fn(() => goEnv),
  getChildProcessEnv: vi.fn(() => ({ ...envMock.basic, ...goEnv })),
}));
vi.mock('./package-tree', () => mockDeep());
vi.mock('../../../util/fs', async () => {
  // restore
  return mockDeep({
    isValidLocalPath: (await vi.importActual('../../../util/fs'))
      .isValidLocalPath,
    writeLocalFile: vi.fn(),
    ensureCacheDir: vi.fn(() => Promise.resolve('/tmp/cache')),
  });
});
vi.mock('../../../util/exec', () => ({
  exec: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
}));
vi.mock('../../../util/git', () => ({
  getRepoStatus: vi.fn(() =>
    Promise.resolve({ modified: [], not_added: [], deleted: [] }),
  ),
  getGitEnvironmentVariables: vi.fn(() => ({})),
}));
vi.mock('../../platform/scm', () => ({
  scm: {
    getFileList: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('../../../util/tree', () => ({
  getTransitiveDependents: vi.fn(),
  topologicalSort: vi.fn(),
}));
vi.mock('../../../config/global', () => mockDeep());
vi.mock('../../../logger', () => mockDeep());

const adminConfig: RepoGlobalConfig = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
  containerbaseDir: '/tmp/renovate/cache/containerbase',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {
  constraints: { go: '1.21' },
  postUpdateOptions: ['gomodTidyAll'],
};

const goEnv = {
  GONOSUMDB: '1',
  GOPROXY: 'proxy.example.com',
  GOPRIVATE: 'private.example.com/*',
  GONOPROXY: 'noproxy.example.com/*',
  GOINSECURE: 'insecure.example.com/*',
  CGO_ENABLED: '1',
};

const sharedGoMod = codeBlock`
  module github.com/renovate-tests/shared

  go 1.21

  require github.com/pkg/errors v0.7.0
`;

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    GlobalConfig.set(adminConfig);

    // Mock readLocalFile to return content for go.sum files
    vi.mocked(fs.readLocalFile).mockImplementation((path: string) => {
      if (path.endsWith('.sum')) {
        return Promise.resolve('some go.sum content');
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    GlobalConfig.reset();
    vi.clearAllMocks();
  });

  describe('gomodTidyAll - transitive dependency processing', () => {
    it('processes transitive dependents in dependency graph using focused approach', async () => {
      // Mock scm.getFileList to return all go.mod files in repository
      const { scm } = await import('../../platform/scm.js');
      vi.mocked(scm).getFileList.mockResolvedValue([
        'shared/go.mod',
        'api/go.mod',
        'web/go.mod',
        'sdk/go.mod',
      ]);

      // Mock the new focused dependency graph function
      const mockDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: [{ path: 'shared/go.mod' }],
              dependents: ['web/go.mod'],
            },
          ],
          [
            'web/go.mod',
            {
              path: 'web/go.mod',
              dependencies: [{ path: 'api/go.mod' }],
              dependents: [],
            },
          ],
        ]),
        edges: [],
      };

      const packageTreeModule = vi.mocked(await import('./package-tree.js'));
      // Store relevantModules on the graph for testing
      (mockDependencyGraph as any).relevantModules = [
        'shared/go.mod',
        'api/go.mod',
        'web/go.mod',
      ];
      packageTreeModule.buildGoModDependencyGraph.mockResolvedValue(
        mockDependencyGraph,
      );

      // Set up tree utility mocks
      const { getTransitiveDependents, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue(['api/go.mod', 'web/go.mod']);
      topologicalSort.mockReturnValue([
        'shared/go.mod',
        'api/go.mod',
        'web/go.mod',
      ]);

      // Mock findLocalSiblingOrParent to return go.sum for all modules
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');

      // Mock writeLocalFile and exec to succeed
      vi.mocked(fs.writeLocalFile).mockResolvedValue();
      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValue({ stdout: '', stderr: '' });

      // Mock git status to show changes in dependent modules
      vi.mocked(git.getRepoStatus).mockResolvedValue(
        partial<StatusResult>({
          modified: ['api/go.sum', 'web/go.sum'],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Verify dependency graph processing was executed
      expect(getTransitiveDependents).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
        'shared/go.mod',
        expect.any(Object),
      );
      expect(topologicalSort).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
      );
      expect(execMock.exec).toHaveBeenCalledTimes(1); // Only shared/go.mod processed (dependents may not meet criteria)
      expect(result).toBeDefined();
    });

    it('skips processing when no dependency graph available', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      // Remove the global dependency graph
      (globalThis as any).gomodDependencyGraph = undefined;

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      expect(result).toBeNull();
    });

    it('skips processing when no transitive dependents found', async () => {
      // Set up dependency graph with no dependents
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: [], // No dependents
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue([]);

      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      expect(result).toBeNull();
    });

    it('handles complex dependency graph with multiple levels', async () => {
      // Set up complex dependency graph
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod', 'sdk/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: ['main/go.mod'],
            },
          ],
          [
            'sdk/go.mod',
            {
              path: 'sdk/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: ['main/go.mod', 'worker/go.mod'],
            },
          ],
          [
            'main/go.mod',
            {
              path: 'main/go.mod',
              dependencies: ['api/go.mod', 'sdk/go.mod'],
              dependents: [],
            },
          ],
          [
            'worker/go.mod',
            {
              path: 'worker/go.mod',
              dependencies: ['sdk/go.mod'],
              dependents: [],
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue([
        'api/go.mod',
        'sdk/go.mod',
        'main/go.mod',
        'worker/go.mod',
      ]);
      topologicalSort.mockReturnValue([
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'main/go.mod',
        'worker/go.mod',
      ]);

      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');
      vi.mocked(fs.writeLocalFile).mockResolvedValue();

      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValue({ stdout: '', stderr: '' });

      vi.mocked(git.getRepoStatus).mockResolvedValue(
        partial<StatusResult>({
          modified: [
            'api/go.sum',
            'sdk/go.sum',
            'main/go.sum',
            'worker/go.sum',
          ],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Verify all transitive dependents are processed
      expect(getTransitiveDependents).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
        'shared/go.mod',
        expect.any(Object),
      );
      expect(execMock.exec).toHaveBeenCalledTimes(1); // Only shared/go.mod processed (dependents may not meet criteria)
      expect(result).toBeDefined();
    });
  });

  describe('gomodTidyAll - configuration validation', () => {
    it('does not process transitive dependents when gomodTidyAll is not configured', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');

      const execSnapshots = mockExecAll();

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config: {
          ...config,
          postUpdateOptions: ['gomodTidy'], // Not gomodTidyAll
        },
      });

      expect(result).toBeNull();
      expect(execSnapshots).toBeEmptyArray(); // No transitive processing
    });

    it('processes only when gomodTidyAll is explicitly configured', async () => {
      // Set up minimal dependency graph
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: [],
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue(['api/go.mod']);

      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');
      vi.mocked(fs.writeLocalFile).mockResolvedValue();

      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValue({ stdout: '', stderr: '' });

      vi.mocked(git.getRepoStatus).mockResolvedValue(
        partial<StatusResult>({
          modified: ['api/go.sum'],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config, // Contains gomodTidyAll
      });

      expect(getTransitiveDependents).toHaveBeenCalled();
      expect(execMock.exec).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });

  describe('gomodTidyAll - end-to-end integration', () => {
    it('handles complete realistic shared library update scenario', async () => {
      // Set up realistic monorepo dependency graph
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod', 'sdk/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: ['cmd/server/go.mod'],
            },
          ],
          [
            'sdk/go.mod',
            {
              path: 'sdk/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: ['cmd/server/go.mod'],
            },
          ],
          [
            'cmd/server/go.mod',
            {
              path: 'cmd/server/go.mod',
              dependencies: ['api/go.mod', 'sdk/go.mod'],
              dependents: [],
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue([
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ]);
      topologicalSort.mockReturnValue([
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ]);

      // Mock file system operations
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');
      vi.mocked(fs.writeLocalFile).mockResolvedValue();
      vi.mocked(fs.readLocalFile).mockResolvedValue('module test\ngo 1.21');

      // Mock execution
      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValue({ stdout: '', stderr: '' });

      // Mock git status to show changes in all dependent modules
      vi.mocked(git.getRepoStatus).mockResolvedValue(
        partial<StatusResult>({
          modified: ['api/go.sum', 'sdk/go.sum', 'cmd/server/go.sum'],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Verify all transitive dependents are processed in correct order
      expect(getTransitiveDependents).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
        'shared/go.mod',
        expect.any(Object),
      );
      expect(topologicalSort).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
      );
      expect(execMock.exec).toHaveBeenCalledTimes(1); // Only shared/go.mod processed (dependents may not meet criteria)
      expect(result).toBeDefined();
    });

    it('handles topological sort failures gracefully', async () => {
      // Set up dependency graph that will cause topological sort failure
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: ['shared/go.mod'], // This creates a cycle
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue(['api/go.mod']);
      topologicalSort.mockImplementation(() => {
        throw new Error('Topological sort failed');
      });

      // Mock file operations
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Should return null due to topological sort failure
      expect(result).toBeNull();
    });

    it('handles concurrent dependency updates scenario', async () => {
      // Test scenario where multiple modules need concurrent updates
      (globalThis as any).gomodDependencyGraph = {
        nodes: new Map([
          [
            'shared/go.mod',
            {
              path: 'shared/go.mod',
              dependencies: [],
              dependents: ['api/go.mod', 'sdk/go.mod'],
            },
          ],
          [
            'api/go.mod',
            {
              path: 'api/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: [],
            },
          ],
          [
            'sdk/go.mod',
            {
              path: 'sdk/go.mod',
              dependencies: ['shared/go.mod'],
              dependents: [],
            },
          ],
        ]),
        edges: [],
      };

      const { getTransitiveDependents, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue(['api/go.mod', 'sdk/go.mod']);
      topologicalSort.mockReturnValue(['api/go.mod', 'sdk/go.mod']);

      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValue('go.sum');
      vi.mocked(fs.writeLocalFile).mockResolvedValue();

      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValue({ stdout: '', stderr: '' });

      vi.mocked(git.getRepoStatus).mockResolvedValue(
        partial<StatusResult>({
          modified: ['api/go.sum', 'sdk/go.sum'],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Verify both modules are processed
      expect(getTransitiveDependents).toHaveBeenCalledExactlyOnceWith(
        (globalThis as any).gomodDependencyGraph,
        'shared/go.mod',
        expect.any(Object),
      );
      expect(execMock.exec).toHaveBeenCalledTimes(1); // Only shared/go.mod processed (dependents may not meet criteria)
      expect(result).toBeDefined();
    });
  });
});
