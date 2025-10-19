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

// Mock tree utilities
vi.mock('../../../util/tree', () => ({
  buildDependencyGraph: vi.fn(),
  getTransitiveDependents: vi.fn(),
  topologicalSort: vi.fn(),
}));

// Create mock graph for tests
const mockGraph = new Map([
  [
    '/workspace/shared/utils/go.mod',
    {
      path: '/workspace/shared/utils/go.mod',
      dependencies: [],
      dependents: [
        '/workspace/services/billing/go.mod',
        '/workspace/services/notification/go.mod',
      ],
    },
  ],
  [
    '/workspace/services/billing/go.mod',
    {
      path: '/workspace/services/billing/go.mod',
      dependencies: ['/workspace/shared/utils/go.mod'],
      dependents: [],
    },
  ],
  [
    '/workspace/services/notification/go.mod',
    {
      path: '/workspace/services/notification/go.mod',
      dependencies: ['/workspace/shared/utils/go.mod'],
      dependents: [],
    },
  ],
  [
    '/workspace/services/user/go.mod',
    {
      path: '/workspace/services/user/go.mod',
      dependencies: ['/workspace/shared/utils/go.mod'],
      dependents: [],
    },
  ],
  [
    '/workspace/services/payment/go.mod',
    {
      path: '/workspace/services/payment/go.mod',
      dependencies: ['/workspace/shared/utils/go.mod'],
      dependents: [],
    },
  ],
]);

describe('modules/manager/gomod/package-tree', () => {
  describe('parseReplaceDirectives', () => {
    it('should parse real-world go.mod replace directives', () => {
      const goModContent = `module github.com/mycompany/myservice

go 1.21

require (
	github.com/company/utils v1.2.3
	github.com/external/api v4.5.6
)

replace github.com/company/utils => ../utils
replace github.com/external/api => ./forked-api v4.5.6
replace (
    github.com/legacy/dep => ../legacy-deps/legacy
    github.com/github.com/fork/repo => https://github.com/fork/repo v1.0.0
)`;

      const directives = parseReplaceDirectives(goModContent);
      expect(directives).toEqual([
        { oldPath: 'github.com/company/utils', newPath: '../utils' },
        { oldPath: 'github.com/external/api', newPath: 'forked-api' },
        { oldPath: 'github.com/legacy/dep', newPath: '../legacy-deps/legacy' },
      ]);
    });
  });

  describe('resolveGoModulePath', () => {
    it('should resolve paths like in a monorepo structure', () => {
      const baseModPath = '/workspace/services/user-service/go.mod';

      // Relative to parent directory
      const dep1 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/company/shared',
        newPath: '../shared-lib',
      });
      expect(dep1).toBe('/workspace/services/shared-lib/go.mod');

      // Same directory
      const dep2 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/company/local',
        newPath: './internal',
      });
      expect(dep2).toBe('/workspace/services/user-service/internal/go.mod');

      // Nested path
      const dep3 = resolveGoModulePath(baseModPath, {
        oldPath: 'github.com/company/nested',
        newPath: '../../packages/nested-lib',
      });
      expect(dep3).toBe('/workspace/packages/nested-lib/go.mod');
    });
  });

  describe('parseGoModDependencies', () => {
    it('should extract dependencies from microservice go.mod', () => {
      const microserviceGoMod = `module github.com/mycompany/payment-service

go 1.21

replace github.com/mycompany/common => ../common
replace github.com/mycompany/auth => ../../auth-service
replace github.com/stripe/stripe-go => github.com/mycompany/stripe-go v1.0.0`;

      const deps = parseGoModDependencies(
        '/workspace/services/payment-service/go.mod',
        microserviceGoMod,
      );

      expect(deps).toHaveLength(2);
      expect(deps[0]).toMatchObject({
        path: 'github.com/mycompany/common',
        resolvedPath: '/workspace/services/common/go.mod',
      });
      expect(deps[1]).toMatchObject({
        path: 'github.com/mycompany/auth',
        resolvedPath: '/workspace/auth-service/go.mod',
      });
    });
  });

  describe('hasLocalReplaceDirectives', () => {
    it('should detect local replacements in enterprise monorepo', () => {
      const enterpriseGoMod = `module github.com/enterprise/platform

go 1.21

replace github.com/enterprise/core => ../core
replace github.com/enterprise/db => ./database
replace github.com/golang/protobuf => github.com/protocolbuffers/protobuf-go v1.28.0`;

      expect(hasLocalReplaceDirectives(enterpriseGoMod)).toBe(true);
    });

    it('should return false for go.mod with only remote replacements', () => {
      const remoteOnlyGoMod = `module github.com/myapp/api

go 1.21

replace github.com/orig/lib => github.com/fork/lib v2.0.0
replace github.com/upstream/dep => github.com/custom/dep v1.5.0`;

      expect(hasLocalReplaceDirectives(remoteOnlyGoMod)).toBe(false);
    });
  });

  describe('getModuleName', () => {
    it('should extract module names from various go.mod formats', () => {
      const cases = [
        {
          content: `module github.com/hashicorp/consul

go 1.21

require github.com/hashicorp/serf v0.9.6`,
          expected: 'github.com/hashicorp/consul',
        },
        {
          content: `module github.com/kubernetes/client-go

go 1.19`,
          expected: 'github.com/kubernetes/client-go',
        },
        {
          content: `// Simple go.mod without module
go 1.21`,
          expected: null,
        },
        {
          content: '',
          expected: null,
        },
      ];

      cases.forEach(({ content, expected }) => {
        expect(getModuleName(content)).toBe(expected);
      });
    });
  });

  describe('dependency graph functions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should find dependents of updated shared library', async () => {
      const { buildDependencyGraph, getTransitiveDependents } = await import(
        '../../../util/tree'
      );

      // Mock buildDependencyGraph to return our mock graph
      vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
      vi.mocked(getTransitiveDependents).mockReturnValue([
        '/workspace/services/billing/go.mod',
        '/workspace/services/notification/go.mod',
      ]);

      const dependents = await getTransitiveDependentModules(
        '/workspace/shared/utils/go.mod',
      );

      expect(buildDependencyGraph).toHaveBeenCalled();
      expect(getTransitiveDependents).toHaveBeenCalledWith(
        mockGraph,
        '/workspace/shared/utils/go.mod',
        { includeSelf: false, direction: 'dependents' },
      );
      expect(dependents).toEqual([
        '/workspace/services/billing/go.mod',
        '/workspace/services/notification/go.mod',
      ]);
    });

    it('should return correct dependency order for go mod tidy execution', async () => {
      const { buildDependencyGraph, topologicalSort } = await import(
        '../../../util/tree'
      );

      // Mock buildDependencyGraph to return our mock graph
      vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
      vi.mocked(topologicalSort).mockResolvedValue([
        '/workspace/shared/utils/go.mod',
        '/workspace/services/user/go.mod',
        '/workspace/services/payment/go.mod',
      ]);

      const order = await getGoModulesInDependencyOrder();

      expect(buildDependencyGraph).toHaveBeenCalled();
      expect(topologicalSort).toHaveBeenCalledWith(mockGraph);
      expect(order).toEqual([
        '/workspace/shared/utils/go.mod',
        '/workspace/services/user/go.mod',
        '/workspace/services/payment/go.mod',
      ]);
    });
  });
});
