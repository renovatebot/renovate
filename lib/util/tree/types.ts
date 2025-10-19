export interface DependencyNode<T = string> {
  /**
   * The file path of the dependency node
   */
  path: string;
  /**
   * The dependencies of this node (paths or typed dependencies)
   */
  dependencies: T[];
  /**
   * The dependents (nodes that depend on this node)
   */
  dependents: string[];
}

export interface DependencyGraph<T = string> {
  /**
   * Map of node paths to node data
   */
  nodes: Map<string, DependencyNode<T>>;
  /**
   * All edges in the graph
   */
  edges: {
    from: string;
    to: string;
    dependency: T;
  }[];
}

export interface DependencyGraphOptions<T> {
  /**
   * File pattern to search for in the repository
   */
  filePattern: string | RegExp;
  /**
   * Function to parse dependencies from file content
   */
  parseFileDependencies: (filePath: string, content: string) => T[];
  /**
   * Function to resolve dependency path from base path
   */
  resolveDependencyPath: (basePath: string, dependency: T) => string;
  /**
   * Root directory to start searching from (defaults to current working directory)
   */
  rootDir?: string;
  /**
   * List of files to use for building the dependency graph
   * This list will be filtered using the filePattern
   */
  fileList: string[];
}

export interface GraphTraversalOptions {
  /**
   * Whether to include the starting node in results
   */
  includeSelf?: boolean;
  /**
   * Maximum depth to traverse (unlimited if undefined)
   */
  maxDepth?: number;
  /**
   * Direction of traversal ('dependents' or 'dependencies')
   */
  direction?: 'dependents' | 'dependencies';
}

export interface CircularDependency {
  /**
   * The cycle of nodes that form the circular dependency
   */
  cycle: string[];
  /**
   * The type of circular dependency
   */
  type: 'direct' | 'indirect';
}
