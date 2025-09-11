import { describe, expect, it, vi } from 'vitest';
import { updateArtifacts } from './artifacts';
import type { UpdateArtifact } from '../types';

vi.mock('./package-tree', async () => {
  const actual = await vi.importActual('./package-tree');
  return {
    ...actual,
    getTransitiveDependentModules: vi.fn(),
    getGoModulesInDependencyOrder: vi.fn(),
  };
});

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
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

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
    const { readLocalFile, writeLocalFile, exec, getRepoStatus } = await import(
      '../../../util/fs'
    );
    const { getTransitiveDependentModules, getGoModulesInDependencyOrder } =
      await import('./package-tree');

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

    // Mock dependency tree functions
    vi.mocked(getTransitiveDependentModules).mockResolvedValue([
      '/path/to/project/moduleB/go.mod',
      '/path/to/project/moduleC/go.mod',
    ]);

    vi.mocked(getGoModulesInDependencyOrder).mockResolvedValue([
      ['/path/to/project/moduleA/go.mod'],
      ['/path/to/project/moduleB/go.mod', '/path/to/project/moduleC/go.mod'],
    ]);

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
    expect(getTransitiveDependentModules).toHaveBeenCalledWith(
      '/path/to/project/moduleA/go.mod',
    );
    expect(getGoModulesInDependencyOrder).toHaveBeenCalled();

    // Verify that individual go mod tidy commands were added
    expect(exec).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('(cd /path/to/project/moduleA && go mod tidy'),
        expect.stringContaining('(cd /path/to/project/moduleB && go mod tidy'),
        expect.stringContaining('(cd /path/to/project/moduleC && go mod tidy'),
      ]),
      expect.any(Object),
    );
  });

  it('should skip gomodTidyAll when no dependent modules found', async () => {
    const { readLocalFile, writeLocalFile, exec, getRepoStatus } = await import(
      '../../../util/fs'
    );
    const { getTransitiveDependentModules } = await import('./package-tree');

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

    // Mock no dependent modules
    vi.mocked(getTransitiveDependentModules).mockResolvedValue([]);

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
    expect(getTransitiveDependentModules).toHaveBeenCalledWith(
      '/path/to/project/moduleA/go.mod',
    );
  });

  it('should handle gomodTidyAll errors gracefully', async () => {
    const { readLocalFile, writeLocalFile, exec, getRepoStatus } = await import(
      '../../../util/fs'
    );
    const { getTransitiveDependentModules } = await import('./package-tree');

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

    // Mock error in dependency tree functions
    vi.mocked(getTransitiveDependentModules).mockRejectedValue(
      new Error('Network error'),
    );

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
    expect(getTransitiveDependentModules).toHaveBeenCalledWith(
      '/path/to/project/moduleA/go.mod',
    );
  });

  it('should not enable gomodTidyAll when not in postUpdateOptions', async () => {
    const { readLocalFile, writeLocalFile, exec, getRepoStatus } = await import(
      '../../../util/fs'
    );
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
