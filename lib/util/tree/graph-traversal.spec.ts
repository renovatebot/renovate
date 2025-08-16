import { Graph } from 'graph-data-structure';
import {
  recursivelyTraverseGraph,
  convertTraversalMapToResults,
  getDependentNodes,
} from './graph-traversal';

describe('util/tree/graph-traversal', () => {
  describe('recursivelyTraverseGraph', () => {
    it('traverses a simple dependency chain', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service');
      graph.addEdge('service', 'api');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph('common', graph, visitedNodes);

      expect(visitedNodes.get('common')).toBe(false);
      expect(visitedNodes.get('service')).toBe(false);
      expect(visitedNodes.get('api')).toBe(true);
    });

    it('handles nodes with no dependents (leaf nodes)', () => {
      const graph = new Graph();
      graph.addNode('standalone');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph('standalone', graph, visitedNodes);

      expect(visitedNodes.get('standalone')).toBe(true);
      expect(visitedNodes.size).toBe(1);
    });

    it('handles multiple dependents (diamond dependency)', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service-a');
      graph.addEdge('common', 'service-b');
      graph.addEdge('service-a', 'api');
      graph.addEdge('service-b', 'api');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph('common', graph, visitedNodes);

      expect(visitedNodes.get('common')).toBe(false);
      expect(visitedNodes.get('service-a')).toBe(false);
      expect(visitedNodes.get('service-b')).toBe(false);
      expect(visitedNodes.get('api')).toBe(true);
      expect(visitedNodes.size).toBe(4);
    });

    it('avoids infinite recursion with already visited nodes', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service');
      graph.addEdge('service', 'api');

      const visitedNodes = new Map<string, boolean>();
      visitedNodes.set('service', false); // Pre-mark as visited

      recursivelyTraverseGraph('common', graph, visitedNodes);

      // Should only add common, service was already visited
      expect(visitedNodes.get('common')).toBe(false);
      expect(visitedNodes.get('service')).toBe(false);
      expect(visitedNodes.has('api')).toBe(false); // api not visited because service was pre-visited
      expect(visitedNodes.size).toBe(2);
    });

    it('respects maxDepth option to prevent infinite recursion', () => {
      const graph = new Graph();
      graph.addEdge('level1', 'level2');
      graph.addEdge('level2', 'level3');
      graph.addEdge('level3', 'level4');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph('level1', graph, visitedNodes, { maxDepth: 2 });

      expect(visitedNodes.has('level1')).toBe(true);
      expect(visitedNodes.has('level2')).toBe(true);
      expect(visitedNodes.has('level3')).toBe(true);
      expect(visitedNodes.has('level4')).toBe(false); // Should not reach level4 due to maxDepth
    });

    it('handles post-order traversal', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service');
      graph.addEdge('service', 'api');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph('common', graph, visitedNodes, {
        preOrder: false,
      });

      // With post-order, should still visit all nodes
      expect(visitedNodes.has('common')).toBe(true);
      expect(visitedNodes.has('service')).toBe(true);
      expect(visitedNodes.has('api')).toBe(true);
    });

    it('handles custom types for nodes', () => {
      const graph = new Graph();
      graph.addEdge('node1', 'node2');

      const visitedNodes = new Map<string, boolean>();
      recursivelyTraverseGraph<string>('node1', graph, visitedNodes);

      expect(visitedNodes.get('node1')).toBe(false);
      expect(visitedNodes.get('node2')).toBe(true);
    });
  });

  describe('convertTraversalMapToResults', () => {
    it('converts Map to TraversalResult array', () => {
      const visitedNodes = new Map<string, boolean>();
      visitedNodes.set('common', false);
      visitedNodes.set('service', false);
      visitedNodes.set('api', true);

      const results = convertTraversalMapToResults(visitedNodes);

      expect(results).toEqual([
        { node: 'common', isLeaf: false },
        { node: 'service', isLeaf: false },
        { node: 'api', isLeaf: true },
      ]);
    });

    it('handles empty map', () => {
      const visitedNodes = new Map<string, boolean>();
      const results = convertTraversalMapToResults(visitedNodes);

      expect(results).toEqual([]);
    });

    it('handles single node', () => {
      const visitedNodes = new Map<string, boolean>();
      visitedNodes.set('standalone', true);

      const results = convertTraversalMapToResults(visitedNodes);

      expect(results).toEqual([{ node: 'standalone', isLeaf: true }]);
    });

    it('preserves order from Map iteration', () => {
      const visitedNodes = new Map<string, boolean>();
      visitedNodes.set('first', true);
      visitedNodes.set('second', false);
      visitedNodes.set('third', true);

      const results = convertTraversalMapToResults(visitedNodes);

      expect(results.map((r) => r.node)).toEqual(['first', 'second', 'third']);
    });

    it('works with custom types', () => {
      const visitedNodes = new Map<number, boolean>();
      visitedNodes.set(1, false);
      visitedNodes.set(2, true);

      const results = convertTraversalMapToResults<number>(visitedNodes);

      expect(results).toEqual([
        { node: 1, isLeaf: false },
        { node: 2, isLeaf: true },
      ]);
    });
  });

  describe('getDependentNodes', () => {
    it('returns dependent nodes in standard format', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service');
      graph.addEdge('service', 'api');

      const results = getDependentNodes('common', graph);

      expect(results).toEqual([
        { node: 'common', isLeaf: false },
        { node: 'service', isLeaf: false },
        { node: 'api', isLeaf: true },
      ]);
    });

    it('excludes start node when excludeStartNode is true', () => {
      const graph = new Graph();
      graph.addEdge('common', 'service');
      graph.addEdge('service', 'api');

      const results = getDependentNodes('common', graph, {
        excludeStartNode: true,
      });

      expect(results).toEqual([
        { node: 'service', isLeaf: false },
        { node: 'api', isLeaf: true },
      ]);
    });

    it('handles single node with excludeStartNode', () => {
      const graph = new Graph();
      graph.addNode('standalone');

      const results = getDependentNodes('standalone', graph, {
        excludeStartNode: true,
      });

      expect(results).toEqual([]);
    });

    it('handles complex dependency graph with exclusion', () => {
      const graph = new Graph();
      graph.addEdge('central', 'service-a');
      graph.addEdge('central', 'service-b');
      graph.addEdge('service-a', 'api');
      graph.addEdge('service-b', 'api');

      const results = getDependentNodes('central', graph, {
        excludeStartNode: true,
      });

      expect(results).toEqual([
        { node: 'service-a', isLeaf: false },
        { node: 'api', isLeaf: true },
        { node: 'service-b', isLeaf: false },
      ]);
    });

    it('passes through traversal options', () => {
      const graph = new Graph();
      graph.addEdge('level1', 'level2');
      graph.addEdge('level2', 'level3');
      graph.addEdge('level3', 'level4');

      const results = getDependentNodes('level1', graph, { maxDepth: 2 });

      expect(results).toHaveLength(3); // level1, level2, level3 (level4 excluded by maxDepth)
      expect(results.map((r) => r.node)).toContain('level1');
      expect(results.map((r) => r.node)).toContain('level2');
      expect(results.map((r) => r.node)).toContain('level3');
      expect(results.map((r) => r.node)).not.toContain('level4');
    });
  });
});
