import type { Graph } from 'graph-data-structure';
import type { GraphTraversalOptions, TraversalResult } from './types';

/**
 * Recursively traverse a graph to find all dependent nodes at any level of ancestry
 *
 * This function performs a graph traversal to collect all nodes that are transitively
 * dependent on a given starting node. It uses pre-order traversal by default and
 * tracks visited nodes to avoid infinite loops.
 *
 * @param startNode - The node to start traversal from
 * @param graph - The graph data structure to traverse
 * @param visitedNodes - Map to track visited nodes and their leaf status
 * @param options - Traversal options
 *
 * @example
 * // Find all modules that depend on a given module
 * const graph = new Graph();
 * graph.addEdge('common', 'service');
 * graph.addEdge('service', 'api');
 *
 * const visited = new Map();
 * recursivelyTraverseGraph('common', graph, visited);
 * // visited will contain: common (false), service (false), api (true)
 */
export function recursivelyTraverseGraph<T = string>(
  startNode: T,
  graph: Graph,
  visitedNodes: Map<T, boolean>,
  options: GraphTraversalOptions = {},
): void {
  const { preOrder = true, maxDepth = 100 } = options;

  // Internal recursive function with depth tracking
  function traverse(currentNode: T, currentDepth: number): void {
    // Prevent infinite recursion
    if (currentDepth > maxDepth) {
      return;
    }

    // If we have already visited this node, skip it
    if (visitedNodes.has(currentNode)) {
      return;
    }

    // Get all nodes that depend on the current node
    const dependents = graph.adjacent(currentNode as string);

    // Determine if this is a leaf node (no dependents)
    const isLeaf = !dependents || dependents.size === 0;

    if (preOrder) {
      // Add current node first (pre-order traversal)
      visitedNodes.set(currentNode, isLeaf);
    }

    // If this node has dependents, traverse them recursively
    if (!isLeaf) {
      for (const dependent of dependents) {
        traverse(dependent as T, currentDepth + 1);
      }
    }

    if (!preOrder) {
      // Add current node after children (post-order traversal)
      visitedNodes.set(currentNode, isLeaf);
    }
  }

  // Start the traversal
  traverse(startNode, 0);
}

/**
 * Convert a Map of visited nodes to an array of TraversalResult objects
 *
 * @param visitedNodes - Map of nodes and their leaf status from traversal
 * @returns Array of traversal results with node and leaf information
 */
export function convertTraversalMapToResults<T = string>(
  visitedNodes: Map<T, boolean>,
): TraversalResult<T>[] {
  return Array.from(visitedNodes.entries()).map(([node, isLeaf]) => ({
    node,
    isLeaf,
  }));
}
