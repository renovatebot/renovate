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
 * Options for dependency file operations
 */
export interface DependencyTraversalOptions extends GraphTraversalOptions {
  /** Node to exclude from final results (useful for central management) */
  excludeStartNode?: boolean;
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
