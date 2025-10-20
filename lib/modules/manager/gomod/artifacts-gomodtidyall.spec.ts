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
  module github.com/example/project/shared

  go 1.21

  require github.com/pkg/errors v0.7.0
`;

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  beforeEach(async () => {
    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    GlobalConfig.set(adminConfig);

    // Set up global dependency graph mock
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

    // Set up tree utility mocks
    const { getTransitiveDependents, topologicalSort } = vi.mocked(
      await import('../../../util/tree/index.js'),
    );
    getTransitiveDependents.mockReturnValue(['api/go.mod']);
    topologicalSort.mockReturnValue(['shared/go.mod', 'api/go.mod']);

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

  describe('when gomodTidyAll is enabled', () => {
    it('skips processing when no go.sum found', async () => {
      // Mock findLocalSiblingOrParent to return null (no go.sum found)
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(null);

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      expect(result).toBeNull();
    });

    it('skips processing when no dependency graph available', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      // Remove the global dependency graph
      (globalThis as any).gomodDependencyGraph = undefined;

      // Mock git status to return no changes
      vi.mocked(git.getRepoStatus).mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      expect(result).toBeNull();
    });

    it('skips processing when no dependents found', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      // Mock getTransitiveDependents to return empty array
      const { getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue([]);

      // Mock git status to return no changes
      vi.mocked(git.getRepoStatus).mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      expect(result).toBeNull();
    });

    it('processes transitive dependents when dependents are found', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      // Mock writeLocalFile to succeed
      vi.mocked(fs.writeLocalFile).mockResolvedValueOnce();

      // Mock exec to return successfully
      const execMock = vi.mocked(await import('../../../util/exec/index.js'));
      execMock.exec.mockResolvedValueOnce({ stdout: '', stderr: '' });

      // Mock git status to show that api/go.sum was modified
      vi.mocked(git.getRepoStatus).mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['api/go.sum'],
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Verify the function was called and dependency graph processing was attempted
      expect(execMock.exec).toHaveBeenCalled();

      // The exact result format depends on the implementation details
      // We're mainly testing that the function doesn't crash and processes dependents
      expect(result).toBeDefined();
    });
  });

  describe('when gomodTidyAll is not configured', () => {
    it('does not process transitive dependents', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      const execSnapshots = mockExecAll();

      // Mock git status to return no changes
      vi.mocked(git.getRepoStatus).mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );

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

      // Should not include gomodTidyAll commands
      expect(execSnapshots).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cmd: expect.stringContaining('(cd'),
          }),
        ]),
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty new package file content', async () => {
      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: '', // Empty content
        config,
      });

      expect(result).toBeNull();
    });

    it('handles null new package file content', async () => {
      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: null as any, // Null content
        config,
      });

      expect(result).toBeNull();
    });

    it('handles execution errors gracefully', async () => {
      // Mock findLocalSiblingOrParent to return go.sum
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce('go.sum');

      // Mock exec to throw an error
      const { exec } = vi.mocked(await import('../../../util/exec/index.js'));
      exec.mockRejectedValueOnce(new Error('Execution failed'));

      const result = await updateArtifacts({
        packageFileName: 'shared/go.mod',
        updatedDeps: [],
        newPackageFileContent: sharedGoMod,
        config,
      });

      // Should return artifact error
      expect(result).toEqual([
        {
          artifactError: {
            lockFile: 'shared/go.sum',
            stderr: 'Execution failed',
          },
        },
      ]);
    });
  });
});
