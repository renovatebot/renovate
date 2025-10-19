import { describe, expect, it, vi } from 'vitest';
import {
  getGoModulesInDependencyOrder,
  getModuleName,
  getTransitiveDependentModules,
  hasLocalReplaceDirectives,
  parseGoModDependencies,
  parseReplaceDirectives,
  resolveGoModulePath,
} from './package-tree';

vi.mock('../../../util/tree', () => ({
  buildDependencyGraph: vi.fn(),
  getTransitiveDependents: vi.fn(),
  topologicalSort: vi.fn(),
}));

const mockGraph = new Map([
  [
    '/workspace/go.mod',
    {
      path: '/workspace/go.mod',
      dependencies: [],
      dependents: [
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
      ],
    },
  ],
  [
    '/workspace/internal/go.mod',
    {
      path: '/workspace/internal/go.mod',
      dependencies: ['/workspace/go.mod'],
      dependents: ['/workspace/cmd/server/go.mod'],
    },
  ],
  [
    '/workspace/pkg/api/go.mod',
    {
      path: '/workspace/pkg/api/go.mod',
      dependencies: ['/workspace/go.mod'],
      dependents: ['/workspace/cmd/server/go.mod', '/workspace/cmd/cli/go.mod'],
    },
  ],
  [
    '/workspace/pkg/client/go.mod',
    {
      path: '/workspace/pkg/client/go.mod',
      dependencies: ['/workspace/go.mod'],
      dependents: ['/workspace/cmd/server/go.mod'],
    },
  ],
  [
    '/workspace/cmd/server/go.mod',
    {
      path: '/workspace/cmd/server/go.mod',
      dependencies: [
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
      ],
      dependents: [],
    },
  ],
  [
    '/workspace/cmd/cli/go.mod',
    {
      path: '/workspace/cmd/cli/go.mod',
      dependencies: ['/workspace/go.mod', '/workspace/pkg/api/go.mod'],
      dependents: [],
    },
  ],
]);

describe('modules/manager/gomod/package-tree', () => {
  describe('parseReplaceDirectives', () => {
    it('parses complex replace directive patterns from monorepo go.mod', () => {
      const goModContent = `module github.com/hashicorp/consul

go 1.21

require (
	github.com/hashicorp/consul/api v1.25.1
	github.com/hashicorp/serf v0.9.6
)

replace github.com/hashicorp/consul/api => ./api
replace github.com/hashicorp/consul/sdk => ./sdk
replace (
    github.com/hashicorp/consul agent => ./agent
    github.com/hashicorp/consul tls => ./tls
)`;

      const directives = parseReplaceDirectives(goModContent);
      expect(directives).toEqual([
        { oldPath: 'github.com/hashicorp/consul/api', newPath: 'api' },
        { oldPath: 'github.com/hashicorp/consul/sdk', newPath: 'sdk' },
        { oldPath: 'agent', newPath: 'agent' },
        { oldPath: 'tls', newPath: 'tls' },
      ]);
    });
  });

  describe('resolveGoModulePath', () => {
    it('resolves relative module paths to absolute go.mod locations', () => {
      const baseModPath = '/workspace/consul/go.mod';

      const dep1 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/hashicorp/consul/api',
        newPath: './api',
      });
      expect(dep1).toBe('/workspace/consul/api/go.mod');

      const dep2 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/hashicorp/consul/sdk',
        newPath: './sdk',
      });
      expect(dep2).toBe('/workspace/consul/sdk/go.mod');

      const dep3 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/hashicorp/consul agent',
        newPath: './agent',
      });
      expect(dep3).toBe('/workspace/consul/agent/go.mod');
    });
  });

  describe('parseGoModDependencies', () => {
    it('extracts and resolves local dependencies from go.mod replace directives', () => {
      const kubernetesGoMod = `module k8s.io/kubernetes

go 1.21

replace k8s.io/api => ./staging/src/k8s.io/api
replace k8s.io/apimachinery => ./staging/src/k8s.io/apimachinery
replace k8s.io/client-go => ./staging/src/k8s.io/client-go`;

      const deps = parseGoModDependencies(
        '/workspace/kubernetes/go.mod',
        kubernetesGoMod,
      );

      expect(deps).toHaveLength(3);
      expect(deps[0]).toMatchObject({
        path: 'k8s.io/api',
        resolvedPath: '/workspace/kubernetes/staging/src/k8s.io/api/go.mod',
      });
      expect(deps[1]).toMatchObject({
        path: 'k8s.io/apimachinery',
        resolvedPath:
          '/workspace/kubernetes/staging/src/k8s.io/apimachinery/go.mod',
      });
      expect(deps[2]).toMatchObject({
        path: 'k8s.io/client-go',
        resolvedPath:
          '/workspace/kubernetes/staging/src/k8s.io/client-go/go.mod',
      });
    });
  });

  describe('hasLocalReplaceDirectives', () => {
    it('identifies go.mod files with local replace directives', () => {
      const monorepoGoMod = `module github.com/hashicorp/vault

go 1.21

replace github.com/hashicorp/vault/sdk => ./sdk
replace github.com/hashicorp/vault/api => ./api
replace github.com/hashicorp/vault/database => ../database
replace github.com/golang/protobuf => github.com/protocolbuffers/protobuf-go v1.28.0`;

      expect(hasLocalReplaceDirectives(monorepoGoMod)).toBe(true);
    });

    it('identifies go.mod files with only remote replace directives', () => {
      const remoteOnlyGoMod = `module github.com/kubernetes/autoscaler

go 1.21

replace github.com/orig/lib => github.com/fork/lib v2.0.0
replace github.com/upstream/dep => github.com/custom/dep v1.5.0`;

      expect(hasLocalReplaceDirectives(remoteOnlyGoMod)).toBe(false);
    });
  });

  describe('getModuleName', () => {
    it('extracts module names from various go.mod content formats', () => {
      const testCases = [
        {
          description: 'HashiCorp Consul go.mod with dependencies',
          content: `module github.com/hashicorp/consul

go 1.21

require github.com/hashicorp/serf v0.9.6`,
          expected: 'github.com/hashicorp/consul',
        },
        {
          description: 'Kubernetes client-go minimal go.mod',
          content: `module github.com/kubernetes/client-go

go 1.19`,
          expected: 'github.com/kubernetes/client-go',
        },
        {
          description: 'go.mod without module declaration',
          content: `// Simple go.mod without module
go 1.21`,
          expected: null,
        },
        {
          description: 'empty go.mod content',
          content: '',
          expected: null,
        },
      ];

      testCases.forEach(({ content, expected }) => {
        expect(getModuleName(content)).toBe(expected);
      });
    });
  });

  describe('dependency graph operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('finds all transitive dependents for a given module', async () => {
      const { buildDependencyGraph, getTransitiveDependents } = await import(
        '../../../util/tree'
      );

      vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
      vi.mocked(getTransitiveDependents).mockReturnValue([
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
      ]);

      const dependents = await getTransitiveDependentModules(
        '/workspace/go.mod',
        [
          '/workspace/go.mod',
          '/workspace/internal/go.mod',
          '/workspace/pkg/api/go.mod',
          '/workspace/pkg/client/go.mod',
          '/workspace/cmd/server/go.mod',
          '/workspace/cmd/cli/go.mod',
        ],
      );

      expect(buildDependencyGraph).toHaveBeenCalled();
      expect(getTransitiveDependents).toHaveBeenCalledWith(
        mockGraph,
        '/workspace/go.mod',
        { includeSelf: false, direction: 'dependents' },
      );
      expect(dependents).toEqual([
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
      ]);
    });

    it('determines correct topological order for sequential processing', async () => {
      const { buildDependencyGraph, topologicalSort } = await import(
        '../../../util/tree'
      );

      vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
      vi.mocked(topologicalSort).mockResolvedValue([
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
        '/workspace/cmd/server/go.mod',
        '/workspace/cmd/cli/go.mod',
      ]);

      const order = await getGoModulesInDependencyOrder([
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
        '/workspace/cmd/server/go.mod',
        '/workspace/cmd/cli/go.mod',
      ]);

      expect(buildDependencyGraph).toHaveBeenCalled();
      expect(topologicalSort).toHaveBeenCalledWith(mockGraph);
      expect(order).toEqual([
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
        '/workspace/pkg/client/go.mod',
        '/workspace/cmd/server/go.mod',
        '/workspace/cmd/cli/go.mod',
      ]);
    });
  });
});
