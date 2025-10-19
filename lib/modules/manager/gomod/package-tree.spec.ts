import { describe, expect, it, vi } from 'vitest';
import {
  getGoModulesInDependencyOrder,
  getModuleName,
  getTransitiveDependentModules,
  parseGoModDependencies,
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
  describe('parseGoModDependencies', () => {
    it('extracts and resolves local dependencies from go.mod replace directives', () => {
      const testCases = [
        {
          description: 'Kubernetes monorepo with staging dependencies',
          content: `module k8s.io/kubernetes

go 1.21

replace k8s.io/api => ./staging/src/k8s.io/api
replace k8s.io/apimachinery => ./staging/src/k8s.io/apimachinery
replace k8s.io/client-go => ./staging/src/k8s.io/client-go`,
          basePath: '/workspace/kubernetes/go.mod',
          expectedPaths: [
            'k8s.io/api',
            'k8s.io/apimachinery',
            'k8s.io/client-go',
          ],
          expectedResolvedPaths: [
            '/workspace/kubernetes/staging/src/k8s.io/api/go.mod',
            '/workspace/kubernetes/staging/src/k8s.io/apimachinery/go.mod',
            '/workspace/kubernetes/staging/src/k8s.io/client-go/go.mod',
          ],
        },
        {
          description: 'HashiCorp Consul with API and SDK paths',
          content: `module github.com/hashicorp/consul

go 1.21

replace github.com/hashicorp/consul/api => ./api
replace github.com/hashicorp/consul/sdk => ./sdk`,
          basePath: '/workspace/consul/go.mod',
          expectedPaths: [
            'github.com/hashicorp/consul/api',
            'github.com/hashicorp/consul/sdk',
          ],
          expectedResolvedPaths: [
            '/workspace/consul/api/go.mod',
            '/workspace/consul/sdk/go.mod',
          ],
        },
      ];

      testCases.forEach(
        ({ content, basePath, expectedPaths, expectedResolvedPaths }) => {
          const deps = parseGoModDependencies(basePath, content);

          expect(deps).toHaveLength(expectedPaths.length);
          deps.forEach((dep, index) => {
            expect(dep).toMatchObject({
              path: expectedPaths[index],
              resolvedPath: expectedResolvedPaths[index],
            });
          });
        },
      );
    });
  });

  describe('getModuleName', () => {
    it('extracts module names from go.mod content', () => {
      const testCases = [
        {
          description: 'HashiCorp Consul go.mod',
          content: `module github.com/hashicorp/consul

go 1.21

require github.com/hashicorp/serf v0.9.6`,
          expected: 'github.com/hashicorp/consul',
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

  describe('resolveGoModulePath', () => {
    it('resolves relative module paths to absolute go.mod locations', () => {
      const baseModPath = '/workspace/consul/go.mod';
      const resolved = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/hashicorp/consul/api',
        newPath: './api',
      });
      expect(resolved).toBe('/workspace/consul/api/go.mod');
    });
  });

  describe('dependency graph operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('handles dependency graph operations correctly', async () => {
      const { buildDependencyGraph, getTransitiveDependents, topologicalSort } =
        await import('../../../util/tree');

      vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
      vi.mocked(getTransitiveDependents).mockReturnValue([
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
      ]);
      vi.mocked(topologicalSort).mockResolvedValue([
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
      ]);

      // Test transitive dependents
      const dependents = await getTransitiveDependentModules(
        '/workspace/go.mod',
        ['/workspace/go.mod', '/workspace/internal/go.mod'],
      );
      expect(dependents).toEqual([
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
      ]);

      // Test topological order
      const order = await getGoModulesInDependencyOrder(['/workspace/go.mod']);
      expect(order).toEqual([
        '/workspace/go.mod',
        '/workspace/internal/go.mod',
        '/workspace/pkg/api/go.mod',
      ]);

      expect(buildDependencyGraph).toHaveBeenCalledTimes(2);
    });
  });
});
