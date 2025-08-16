/**
 * Tree and graph traversal utilities for dependency management
 *
 * This module provides reusable utilities for working with dependency trees,
 * path resolution, and graph traversal algorithms.
 */

export { reframeRelativePathToRootOfRepo } from './path-utils';
export {
  recursivelyTraverseGraph,
  convertTraversalMapToResults,
  getDependentNodes,
} from './graph-traversal';
export type {
  GraphTraversalOptions,
  TraversalResult,
  DependencyTraversalOptions,
} from './types';
