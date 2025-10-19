import { describe, expect, it, vi } from 'vitest';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';

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

afterEach(() => {
  delete (globalThis as any).gomodDependencyGraph;
});

describe('modules/manager/gomod/artifacts-gomodtidyall', () => {
  const mockUpdateArtifact: UpdateArtifact = {
    packageFileName: '/workspace/consul/go.mod',
    updatedDeps: [],
    newPackageFileContent: 'module github.com/hashicorp/consul\ngo 1.21\n',
    config: {
      postUpdateOptions: ['gomodTidyAll'],
      constraints: {},
      updateType: 'patch',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes dependent modules when gomodTidyAll is enabled', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/workspace/consul/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    const mockGlobalGraph = new Map([
      [
        '/workspace/consul/go.mod',
        {
          path: '/workspace/consul/go.mod',
          dependencies: [],
          dependents: [
            '/workspace/consul/api/go.mod',
            '/workspace/consul/sdk/go.mod',
            '/workspace/consul/agent/go.mod',
          ],
        },
      ],
      [
        '/workspace/consul/api/go.mod',
        {
          path: '/workspace/consul/api/go.mod',
          dependencies: ['/workspace/consul/go.mod'],
          dependents: ['/workspace/consul/cmd/agent/go.mod'],
        },
      ],
      [
        '/workspace/consul/sdk/go.mod',
        {
          path: '/workspace/consul/sdk/go.mod',
          dependencies: ['/workspace/consul/go.mod'],
          dependents: ['/workspace/consul/cmd/agent/go.mod'],
        },
      ],
      [
        '/workspace/consul/agent/go.mod',
        {
          path: '/workspace/consul/agent/go.mod',
          dependencies: ['/workspace/consul/go.mod'],
          dependents: ['/workspace/consul/cmd/agent/go.mod'],
        },
      ],
      [
        '/workspace/consul/cmd/agent/go.mod',
        {
          path: '/workspace/consul/cmd/agent/go.mod',
          dependencies: [
            '/workspace/consul/go.mod',
            '/workspace/consul/api/go.mod',
            '/workspace/consul/sdk/go.mod',
            '/workspace/consul/agent/go.mod',
          ],
          dependents: [],
        },
      ],
    ]);

    (globalThis as any).gomodDependencyGraph = mockGlobalGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();

    delete (globalThis as any).gomodDependencyGraph;
  });

  it('skips processing when no dependent modules exist', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/workspace/consul/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    const mockGlobalGraph = new Map([
      [
        '/workspace/consul/go.mod',
        {
          path: '/workspace/consul/go.mod',
          dependencies: [],
          dependents: [],
        },
      ],
    ]);

    (globalThis as any).gomodDependencyGraph = mockGlobalGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
  });

  it('skips processing when dependency graph is unavailable', async () => {
    const { readLocalFile, writeLocalFile } = await import('../../../util/fs');
    const { exec } = await import('../../../util/exec');
    const { getRepoStatus } = await import('../../../util/git');

    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/workspace/consul/go.sum'],
      added: [],
      deleted: [],
      not_added: [],
      renamed: [],
      files: [],
      staged: [],
    });

    delete (globalThis as any).gomodDependencyGraph;

    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: '' });

    const result = await updateArtifacts(mockUpdateArtifact);

    expect(result).not.toBeNull();
    expect(exec).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('cd /workspace/consul/api && go mod tidy'),
      ]),
    );
  });

  it('does not process when gomodTidyAll is not configured', async () => {
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

    vi.mocked(readLocalFile).mockResolvedValue('go.sum content');
    vi.mocked(writeLocalFile).mockResolvedValue();

    vi.mocked(getRepoStatus).mockResolvedValue({
      modified: ['/workspace/consul/go.sum'],
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
