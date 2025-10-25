import { describe, expect, it } from 'vitest';
import {
  detectCircularDependencies,
  topologicalSort,
} from './dependency-graph';
import type { DependencyGraph } from './types';

describe('util/tree/dependency-graph', () => {
  describe('topologicalSort', () => {
    it('should sort simple dependency graph correctly', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: ['B'], dependents: [] }],
          ['B', { path: 'B', dependencies: ['C'], dependents: ['A'] }],
          ['C', { path: 'C', dependencies: [], dependents: ['B'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', dependency: 'B' },
          { from: 'B', to: 'C', dependency: 'C' },
        ],
      };

      const result = topologicalSort(graph);
      expect(result).toEqual(['C', 'B', 'A']);
    });

    it('should handle independent nodes', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: [], dependents: [] }],
          ['B', { path: 'B', dependencies: [], dependents: [] }],
          ['C', { path: 'C', dependencies: [], dependents: [] }],
        ]),
        edges: [],
      };

      const result = topologicalSort(graph);
      // Order of independent nodes doesn't matter, but all should be included
      expect(result).toHaveLength(3);
      expect(result).toContain('A');
      expect(result).toContain('B');
      expect(result).toContain('C');
    });

    it('should handle complex dependency graph', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: ['B', 'C'], dependents: [] }],
          ['B', { path: 'B', dependencies: ['D'], dependents: ['A'] }],
          ['C', { path: 'C', dependencies: ['D'], dependents: ['A'] }],
          ['D', { path: 'D', dependencies: [], dependents: ['B', 'C'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', dependency: 'B' },
          { from: 'A', to: 'C', dependency: 'C' },
          { from: 'B', to: 'D', dependency: 'D' },
          { from: 'C', to: 'D', dependency: 'D' },
        ],
      };

      const result = topologicalSort(graph);
      expect(result).toHaveLength(4);
      // D should come before B and C
      expect(result.indexOf('D')).toBeLessThan(result.indexOf('B'));
      expect(result.indexOf('D')).toBeLessThan(result.indexOf('C'));
      // B and C should come before A
      expect(result.indexOf('B')).toBeLessThan(result.indexOf('A'));
      expect(result.indexOf('C')).toBeLessThan(result.indexOf('A'));
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect direct circular dependencies', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: ['B'], dependents: ['B'] }],
          ['B', { path: 'B', dependencies: ['A'], dependents: ['A'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', dependency: 'B' },
          { from: 'B', to: 'A', dependency: 'A' },
        ],
      };

      const cycles = detectCircularDependencies(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0].cycle).toEqual(['A', 'B']);
      expect(cycles[0].type).toBe('direct');
    });

    it('should detect indirect circular dependencies', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: ['B'], dependents: ['C'] }],
          ['B', { path: 'B', dependencies: ['C'], dependents: ['A'] }],
          ['C', { path: 'C', dependencies: ['A'], dependents: ['B'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', dependency: 'B' },
          { from: 'B', to: 'C', dependency: 'C' },
          { from: 'C', to: 'A', dependency: 'A' },
        ],
      };

      const cycles = detectCircularDependencies(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0].cycle).toEqual(['A', 'B', 'C']);
      expect(cycles[0].type).toBe('indirect');
    });

    it('should return empty array for acyclic graph', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map([
          ['A', { path: 'A', dependencies: ['B'], dependents: [] }],
          ['B', { path: 'B', dependencies: [], dependents: ['A'] }],
        ]),
        edges: [{ from: 'A', to: 'B', dependency: 'B' }],
      };

      const cycles = detectCircularDependencies(graph);
      expect(cycles).toEqual([]);
    });

    it('should handle empty graph', () => {
      const graph: DependencyGraph<string> = {
        nodes: new Map(),
        edges: [],
      };

      const cycles = detectCircularDependencies(graph);
      expect(cycles).toEqual([]);
    });
  });
});
