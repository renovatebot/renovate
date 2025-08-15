/**
 * Types for tree and graph traversal utilities
 */

/**
 * Options for graph traversal operations
 */
export interface GraphTraversalOptions {
  /** Whether to use pre-order traversal (current node before children) */
  preOrder?: boolean;
  /** Maximum depth to traverse (prevents infinite loops) */
  maxDepth?: number;
}

/**
 * Result of graph traversal with metadata
 */
export interface TraversalResult<T = string> {
  /** The node identifier */
  node: T;
  /** Whether this node is a leaf (has no dependents) */
  isLeaf: boolean;
}
