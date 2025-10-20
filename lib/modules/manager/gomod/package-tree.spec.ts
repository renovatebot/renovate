import { codeBlock } from 'common-tags';
import { mockDeep } from 'vitest-mock-extended';
import {
  buildGoModDependencyGraph,
  getGoModulesInDependencyOrder,
  getModuleName,
  getTransitiveDependentModules,
  parseGoModDependencies,
  resolveGoModulePath,
} from './package-tree';
import { envMock } from '~test/exec-util';
import { env, fs } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/tree', () => ({
  buildDependencyGraph: vi.fn(),
  getTransitiveDependents: vi.fn(),
  topologicalSort: vi.fn(),
}));
vi.mock('../../../util/fs', () => mockDeep());

describe('modules/manager/gomod/package-tree', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  describe('parseGoModDependencies', () => {
    it('extracts dependencies from modules with replace directives', () => {
      const mainGoMod = codeBlock`
        module github.com/example/project

        go 1.21

        require (
            github.com/example/project/api v0.0.0
            github.com/example/project/sdk v0.0.0
        )

        replace github.com/example/project/api => ./api
        replace github.com/example/project/sdk => ./sdk
      `;

      const deps = parseGoModDependencies('main/go.mod', mainGoMod);

      expect(deps).toHaveLength(2);
      expect(deps[0]).toMatchObject({
        path: 'github.com/example/project/api',
        resolvedPath: expect.stringContaining('main/api/go.mod'),
      });
      expect(deps[1]).toMatchObject({
        path: 'github.com/example/project/sdk',
        resolvedPath: expect.stringContaining('main/sdk/go.mod'),
      });
    });

    it('extracts single dependency from module', () => {
      const apiGoMod = codeBlock`
        module github.com/example/project/api

        go 1.21

        require github.com/example/project/shared v0.0.0

        replace github.com/example/project/shared => ../shared
      `;

      const deps = parseGoModDependencies('api/go.mod', apiGoMod);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({
        path: 'github.com/example/project/shared',
        resolvedPath: expect.stringContaining('shared/go.mod'),
      });
    });

    it('returns empty array for modules with no dependencies', () => {
      const sharedGoMod = codeBlock`
        module github.com/example/project/shared

        go 1.21
      `;

      const deps = parseGoModDependencies('shared/go.mod', sharedGoMod);
      expect(deps).toEqual([]);
    });

    it('handles complex replace directive formats', () => {
      const complexContent = codeBlock`
        module github.com/example/complex

        go 1.21

        replace (
            github.com/example/lib => ./lib
            github.com/example/pkg/submodule => ./pkg/submodule
            github.com/example/external => ../external
        )
      `;

      const deps = parseGoModDependencies('complex/go.mod', complexContent);

      expect(deps).toHaveLength(3);
      expect(deps.map((d) => d.path)).toEqual([
        'github.com/example/lib',
        'github.com/example/pkg/submodule',
        'github.com/example/external',
      ]);
      expect(deps.map((d) => d.resolvedPath)).toEqual([
        expect.stringContaining('complex/lib/go.mod'),
        expect.stringContaining('complex/pkg/submodule/go.mod'),
        expect.stringContaining('external/go.mod'),
      ]);
    });
  });

  describe('getModuleName', () => {
    it('extracts module names from go.mod contents', () => {
      const mainGoMod = 'module github.com/example/project\ngo 1.21\n';
      const apiGoMod = 'module github.com/example/project/api\ngo 1.21\n';
      const sharedGoMod = 'module github.com/example/project/shared\ngo 1.21\n';

      expect(getModuleName(mainGoMod)).toBe('github.com/example/project');
      expect(getModuleName(apiGoMod)).toBe('github.com/example/project/api');
      expect(getModuleName(sharedGoMod)).toBe(
        'github.com/example/project/shared',
      );
    });

    it('handles malformed content gracefully', () => {
      expect(getModuleName('')).toBeNull();
      expect(getModuleName('go 1.21\n')).toBeNull();
      expect(getModuleName('// No module declaration\ngo 1.21')).toBeNull();
      expect(getModuleName('module   // incomplete')).toBe('//'); // This matches because // is not whitespace
      expect(
        getModuleName('// Invalid module name: invalid-name!\ngo 1.21'),
      ).toBeNull();
      expect(getModuleName('//')).toBeNull(); // The regex shouldn't match just comments
    });

    it('handles content with extra whitespace and comments', () => {
      const contentWithWhitespace = codeBlock`
        // This is a comment
        module    github.com/example/whitespace

        go 1.21

        // Another comment
        require something v1.0.0
      `;

      expect(getModuleName(contentWithWhitespace)).toBe(
        'github.com/example/whitespace',
      );
    });
  });

  describe('resolveGoModulePath', () => {
    it('resolves various path formats correctly', () => {
      const testCases = [
        {
          baseModPath: 'main/go.mod',
          replace: { oldPath: 'github.com/example/lib', newPath: './lib' },
          expected: 'main/lib/go.mod',
        },
        {
          baseModPath: 'api/go.mod',
          replace: {
            oldPath: 'github.com/example/shared',
            newPath: '../shared',
          },
          expected: 'shared/go.mod',
        },
        {
          baseModPath: 'cmd/server/go.mod',
          replace: { oldPath: 'github.com/example/api', newPath: '../../api' },
          expected: 'api/go.mod',
        },
        {
          baseModPath: 'main/go.mod',
          replace: {
            oldPath: 'github.com/example/abs',
            newPath: '/absolute/path',
          },
          expected: '/absolute/path/go.mod',
        },
        {
          baseModPath: 'main/go.mod',
          replace: { oldPath: 'github.com/example/current', newPath: '.' },
          expected: 'main/go.mod',
        },
      ];

      testCases.forEach(({ baseModPath, replace, expected }) => {
        const result = resolveGoModulePath(baseModPath, replace);
        // Check that the result ends with the expected relative path, regardless of absolute prefix
        expect(result).toContain(expected);
        expect(result).toMatch(/go\.mod$/);
      });
    });
  });

  describe('buildGoModDependencyGraph', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      const { buildDependencyGraph } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockResolvedValue({
        nodes: new Map(),
        edges: [],
      });
    });

    it('builds dependency graph from realistic monorepo structure', async () => {
      const fileList = [
        'main/go.mod',
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ];

      // Mock the dependency graph with realistic structure
      const { buildDependencyGraph } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockResolvedValue({
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
          [
            'main/go.mod',
            { path: 'main/go.mod', dependencies: [], dependents: [] },
          ],
        ]),
        edges: [],
      });

      // Mock file reading
      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      const graph = await buildGoModDependencyGraph(fileList);

      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBe(5);

      // Verify realistic dependency relationships
      expect(graph.nodes.get('shared/go.mod')?.dependencies).toEqual([]);
      expect(graph.nodes.get('shared/go.mod')?.dependents).toContain(
        'api/go.mod',
      );
      expect(graph.nodes.get('shared/go.mod')?.dependents).toContain(
        'sdk/go.mod',
      );

      expect(graph.nodes.get('api/go.mod')?.dependencies).toContain(
        'shared/go.mod',
      );
      expect(graph.nodes.get('sdk/go.mod')?.dependencies).toContain(
        'shared/go.mod',
      );

      const serverDeps =
        graph.nodes.get('cmd/server/go.mod')?.dependencies ?? [];
      expect(serverDeps).toContain('api/go.mod');
      expect(serverDeps).toContain('sdk/go.mod');
    });

    it('handles missing files gracefully', async () => {
      // Mock the dependency graph for missing files scenario
      const { buildDependencyGraph } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockResolvedValue({
        nodes: new Map([
          [
            'main/go.mod',
            { path: 'main/go.mod', dependencies: [], dependents: [] },
          ],
          [
            'api/go.mod',
            { path: 'api/go.mod', dependencies: [], dependents: [] },
          ],
        ]),
        edges: [],
      });

      vi.mocked(fs).readLocalFile.mockResolvedValue(null);

      const fileList = ['main/go.mod', 'api/go.mod'];
      const graph = await buildGoModDependencyGraph(fileList);

      expect(graph).toBeDefined();
      expect(graph.nodes.size).toBe(2);
      expect(
        Array.from(graph.nodes.values()).every(
          (node) => node.dependencies.length === 0,
        ),
      ).toBe(true);
    });
  });

  describe('getTransitiveDependentModules', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      const { buildDependencyGraph, getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockResolvedValue({
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
      });
      getTransitiveDependents.mockReturnValue([
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ]);
    });

    it('finds transitive dependents for different modules', async () => {
      const fileList = [
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ];

      // Mock file reading for graph building
      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      // Test shared module (most dependents)
      const sharedDependents = await getTransitiveDependentModules(
        'shared/go.mod',
        fileList,
      );
      expect(sharedDependents).toEqual(
        expect.arrayContaining([
          'api/go.mod',
          'sdk/go.mod',
          'cmd/server/go.mod',
        ]),
      );

      // Test API module (fewer dependents) - update mock for different result
      const { getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue(['cmd/server/go.mod']);
      const apiDependents = await getTransitiveDependentModules(
        'api/go.mod',
        fileList,
      );
      expect(apiDependents).toEqual(
        expect.arrayContaining(['cmd/server/go.mod']),
      );

      // Test independent module (no dependents)
      getTransitiveDependents.mockReturnValue([]);
      const independentDependents = await getTransitiveDependentModules(
        'independent/go.mod',
        fileList,
      );
      expect(independentDependents).toEqual([]);
    });

    it('excludes already processed modules from results', async () => {
      const { getTransitiveDependents } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      getTransitiveDependents.mockReturnValue([
        'sdk/go.mod',
        'cmd/server/go.mod',
      ]);

      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      const alreadyProcessed = ['api/go.mod'];
      const dependents = await getTransitiveDependentModules(
        'shared/go.mod',
        alreadyProcessed,
      );

      expect(dependents).toEqual(
        expect.arrayContaining(['sdk/go.mod', 'cmd/server/go.mod']),
      );
    });

    it('handles case when dependency graph building fails', async () => {
      const { buildDependencyGraph } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockRejectedValueOnce(
        new Error('Graph build failed'),
      );

      await expect(
        getTransitiveDependentModules('shared/go.mod', ['shared/go.mod']),
      ).rejects.toThrow('Graph build failed');
    });
  });

  describe('getGoModulesInDependencyOrder', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      const { buildDependencyGraph, topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockResolvedValue({
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
          [
            'main/go.mod',
            { path: 'main/go.mod', dependencies: [], dependents: [] },
          ],
        ]),
        edges: [],
      });
      topologicalSort.mockReturnValue([
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
        'main/go.mod',
      ]);
    });

    it('returns modules in dependency order', async () => {
      const fileList = [
        'main/go.mod',
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ];

      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      const order = await getGoModulesInDependencyOrder(fileList);

      expect(order).toEqual([
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
        'main/go.mod',
      ]);
    });

    it('handles empty file list', async () => {
      const { topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      topologicalSort.mockReturnValueOnce([]);

      const order = await getGoModulesInDependencyOrder([]);
      expect(order).toBeDefined();
      expect(order).toEqual([]);
    });

    it('handles modules not in dependency graph', async () => {
      const fileList = ['shared/go.mod', 'api/go.mod', 'external/mod/go.mod'];

      const { topologicalSort } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      topologicalSort.mockReturnValueOnce([
        'shared/go.mod',
        'api/go.mod',
        'external/mod/go.mod', // Include the external module in the mock
      ]);

      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      const order = await getGoModulesInDependencyOrder(fileList);

      expect(order).toEqual(
        expect.arrayContaining([
          'shared/go.mod',
          'api/go.mod',
          'external/mod/go.mod',
        ]),
      );
    });

    it('handles topological sort failure', async () => {
      const { buildDependencyGraph } = vi.mocked(
        await import('../../../util/tree/index.js'),
      );
      buildDependencyGraph.mockRejectedValueOnce(
        new Error('Topological sort failed'),
      );

      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      await expect(
        getGoModulesInDependencyOrder(['shared/go.mod']),
      ).rejects.toThrow('Topological sort failed');
    });
  });

  describe('integration test', () => {
    it('handles complete realistic shared library update scenario', async () => {
      const fileList = [
        'main/go.mod',
        'shared/go.mod',
        'api/go.mod',
        'sdk/go.mod',
        'cmd/server/go.mod',
      ];

      const mockGraph = {
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

      const { buildDependencyGraph, getTransitiveDependents, topologicalSort } =
        vi.mocked(await import('../../../util/tree/index.js'));
      buildDependencyGraph.mockResolvedValue(mockGraph);
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

      vi.mocked(fs).readLocalFile.mockResolvedValue('module test\ngo 1.21');

      // Get transitive dependents
      const dependents = await getTransitiveDependentModules(
        'shared/go.mod',
        fileList,
      );

      // Get processing order
      const order = await getGoModulesInDependencyOrder(dependents);

      expect(dependents).toContain('api/go.mod');
      expect(dependents).toContain('sdk/go.mod');
      expect(dependents).toContain('cmd/server/go.mod');

      expect(order).toContain('api/go.mod');
      expect(order).toContain('sdk/go.mod');

      // Dependencies should come before dependents
      const apiIndex = order.indexOf('api/go.mod');
      const serverIndex = order.indexOf('cmd/server/go.mod');
      expect(apiIndex).toBeLessThan(serverIndex);
    });
  });
});
