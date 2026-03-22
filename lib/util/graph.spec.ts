import { Graph } from 'graph-data-structure';
import { scm } from '~test/util.ts';
import {
  getMatchingFiles,
  getTransitiveDependents,
  resolveRelativePathToRoot,
} from './graph.ts';

describe('util/graph', () => {
  describe('getTransitiveDependents', () => {
    it('returns single leaf node', () => {
      const graph = new Graph();
      graph.addNode('A');

      const deps = getTransitiveDependents(graph, 'A');

      expect(deps).toEqual(new Map([['A', true]]));
    });

    it('returns direct dependents in a linear chain', () => {
      const graph = new Graph();
      // A -> B -> C (A is dependency, C is leaf)
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');

      const deps = getTransitiveDependents(graph, 'A');

      expect(deps).toEqual(
        new Map([
          ['A', false],
          ['B', false],
          ['C', true],
        ]),
      );
    });

    it('handles diamond dependency graph', () => {
      const graph = new Graph();
      // A -> B, A -> C, B -> D, C -> D
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'D');
      graph.addEdge('C', 'D');

      const deps = getTransitiveDependents(graph, 'A');

      expect(deps.get('A')).toBe(false);
      expect(deps.get('B')).toBe(false);
      expect(deps.get('C')).toBe(false);
      expect(deps.get('D')).toBe(true);
      expect(deps.size).toBe(4);
    });

    it('returns only reachable nodes from start', () => {
      const graph = new Graph();
      graph.addEdge('A', 'B');
      graph.addNode('C'); // disconnected

      const deps = getTransitiveDependents(graph, 'A');

      expect(deps).toEqual(
        new Map([
          ['A', false],
          ['B', true],
        ]),
      );
      expect(deps.has('C')).toBe(false);
    });

    it('handles node with no adjacent nodes as leaf', () => {
      const graph = new Graph();
      graph.addEdge('A', 'B');

      const deps = getTransitiveDependents(graph, 'B');

      expect(deps).toEqual(new Map([['B', true]]));
    });

    it('handles tree-shaped graph', () => {
      const graph = new Graph();
      // A -> B, A -> C (two leaf dependents)
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');

      const deps = getTransitiveDependents(graph, 'A');

      expect(deps).toEqual(
        new Map([
          ['A', false],
          ['B', true],
          ['C', true],
        ]),
      );
    });

    it('does not loop on cycles', () => {
      const graph = new Graph();
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'A');

      const deps = getTransitiveDependents(graph, 'A');

      // Both visited, neither is leaf since each has adjacent nodes
      expect(deps).toEqual(
        new Map([
          ['A', false],
          ['B', false],
        ]),
      );
    });
  });

  describe('resolveRelativePathToRoot', () => {
    it('resolves relative path from a subdirectory file', () => {
      const result = resolveRelativePathToRoot(
        'two/two.csproj',
        '../one/one.csproj',
      );
      expect(result).toBe('one/one.csproj');
    });

    it('resolves same-directory reference', () => {
      const result = resolveRelativePathToRoot(
        'moduleA/go.mod',
        './local/go.mod',
      );
      expect(result).toBe('moduleA/local/go.mod');
    });

    it('resolves parent directory reference', () => {
      const result = resolveRelativePathToRoot(
        'services/api/go.mod',
        '../../libs/shared',
      );
      expect(result).toBe('libs/shared');
    });

    it('resolves from root-level file', () => {
      const result = resolveRelativePathToRoot('go.mod', './sub');
      expect(result).toBe('sub');
    });

    it('resolves deeply nested paths', () => {
      const result = resolveRelativePathToRoot(
        'a/b/c/file.txt',
        '../../../other/file.txt',
      );
      expect(result).toBe('other/file.txt');
    });
  });

  describe('getMatchingFiles', () => {
    it('filters files using minimatch pattern', async () => {
      scm.getFileList.mockResolvedValue([
        'one/one.csproj',
        'two/two.vbproj',
        'three/three.fsproj',
        'readme.md',
        'go.mod',
      ]);

      const result = await getMatchingFiles('*.{cs,vb,fs}proj');
      expect(result).toEqual([
        'one/one.csproj',
        'two/two.vbproj',
        'three/three.fsproj',
      ]);
    });

    it('filters go.mod files', async () => {
      scm.getFileList.mockResolvedValue([
        'go.mod',
        'api/go.mod',
        'cmd/go.mod',
        'readme.md',
        'go.sum',
      ]);

      const result = await getMatchingFiles('go.mod');
      expect(result).toEqual(['go.mod', 'api/go.mod', 'cmd/go.mod']);
    });

    it('returns empty array when no files match', async () => {
      scm.getFileList.mockResolvedValue(['readme.md', 'package.json']);

      const result = await getMatchingFiles('go.mod');
      expect(result).toEqual([]);
    });
  });
});
