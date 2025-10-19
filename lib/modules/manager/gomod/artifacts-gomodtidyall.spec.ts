import { describe, expect, it, vi } from 'vitest';
import { updateArtifacts } from './artifacts';
import type { UpdateArtifact } from '../types';

vi.mock('./package-tree', async () => {
  const actual = await vi.importActual('./package-tree');
  return {
    ...actual,
    getTransitiveDependentModules: vi.fn(),
    getGoModulesInDependencyOrder: vi.fn(),
    buildGoModDependencyGraph: vi.fn(),
  };
});

vi.mock('../../../util/tree', () => ({
  buildDependencyGraph: vi.fn(),
  getTransitiveDependents: vi.fn(),
  topologicalSort: vi.fn(),
}));

vi.mock('../../../util/fs', () => ({
  readLocalFile: vi.fn(),
  writeLocalFile: vi.fn(),
  ensureCacheDir: vi.fn(),
  findLocalSiblingOrParent: vi.fn(),
  isValidLocalPath: vi.fn(),
}));

vi.mock('../../../util/exec', () => ({
  exec: vi.fn(),
}));

vi.mock('../../../util/git', () => ({
  getRepoStatus: vi.fn(),
  getGitEnvironmentVariables: vi.fn(() => ({})),
}));

vi.mock('../../../util/env', () => ({
  getEnv: vi.fn(() => ({})),
}));

vi.mock('../../../config/global', () => ({
  GlobalConfig: {
    get: vi.fn(),
  },
}));

vi.mock('../../../logger', () => ({
  logger: {
    debug: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Add afterEach to clean up global state
afterEach(() => {
  // Clean up any global graph mocks
  delete (globalThis as any).gomodDependencyGraph;
});

describe('gomod/artifacts - gomodTidyAll integration', () => {
  const mockUpdateArtifact: UpdateArtifact = {
    packageFileName: '/path/to/project/moduleA/go.mod',
    updatedDeps: [],
    newPackageFileContent: 'module github.com/example/moduleA\ngo 1.21\n',
    config: {
      postUpdateOptions: ['gomodTidyAll'],
      constraints: {},
      updateType: 'patch',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enable gomodTidyAll when postUpdateOptions includes it', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    // Mock file operations
    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    // Mock git status
    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/path/to/project/moduleA/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    // Mock a global dependency graph (simulating extractAllPackageFiles)
    const mockGlobalGraph = new Map([
      [
        '/path/to/project/moduleA/go.mod',
        {
          path: '/path/to/project/moduleA/go.mod',
          dependencies: [],
          dependents: [
            '/path/to/project/moduleB/go.mod',
            '/path/to/project/moduleC/go.mod',
          ],
        },
      ],
      [
        '/path/to/project/moduleB/go.mod',
        {
          path: '/path/to/project/moduleB/go.mod',
          dependencies: ['/path/to/project/moduleA/go.mod'],
          dependents: [],
        },
      ],
      [
        '/path/to/project/moduleC/go.mod',
        {
          path: '/path/to/project/moduleC/go.mod',
          dependencies: ['/path/to/project/moduleA/go.mod'],
          dependents: [],
        },
      ],
    ]);

    // Mock global graph
    (globalThis as any).gomodDependencyGraph = mockGlobalGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();

    // Clean up global mock
    delete (globalThis as any).gomodDependencyGraph;
  });

  it('should skip gomodTidyAll when no dependent modules found', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    // Mock file operations
    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    // Mock git status
    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/path/to/project/moduleA/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    // Mock a global dependency graph with no dependents
    const mockGlobalGraph = new Map([
      [
        '/path/to/project/moduleA/go.mod',
        {
          path: '/path/to/project/moduleA/go.mod',
          dependencies: [],
          dependents: [],
        },
      ],
    ]);

    // Mock global graph
    (globalThis as any).gomodDependencyGraph = mockGlobalGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
  });

  it('should skip gomodTidyAll when no pre-built graph is available', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    // Mock file operations
    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    // Mock git status
    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/path/to/project/moduleA/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    // No global graph
    delete (globalThis as any).gomodDependencyGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
    // Should not have any go mod tidy commands for other modules
    expect(exec).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('cd /path/to/project/moduleB && go mod tidy'),
      ]),
    );
  });

  it('should not enable gomodTidyAll when not in postUpdateOptions', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');
    const { getTransitiveDependentModules } = await import('./package-tree');

    const updateArtifactWithoutTidyAll = {
      ...mockUpdateArtifact,
      config: {
        ...mockUpdateArtifact.config,
        postUpdateOptions: ['gomodTidy'],
      },
    };

    // Mock file operations
    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    // Mock git status
    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/path/to/project/moduleA/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(updateArtifactWithoutTidyAll);

    expect(result).not.toBeNull();
    expect(getTransitiveDependentModules).not.toHaveBeenCalled();
  });
});
