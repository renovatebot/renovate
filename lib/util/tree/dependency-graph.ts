import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../logger';
import { matchRegexOrGlob } from '../../util/string-match';
import { readLocalFile } from '../fs';
import type {
  CircularDependency,
  DependencyGraph,
  DependencyGraphOptions,
  DependencyNode,
  GraphTraversalOptions,
} from './types';

/**
 * Build a dependency graph from files in the repository
 */
export async function buildDependencyGraph<T>(
  options: DependencyGraphOptions<T>,
): Promise<DependencyGraph<T>> {
  const {
    filePattern,
    parseFileDependencies,
    resolveDependencyPath,
    fileList,
  } = options;

  const nodes = new Map<string, DependencyNode<T>>();
  const edges: DependencyGraph<T>['edges'] = [];

  // Filter the provided file list using the pattern
  const files = fileList.filter((file) => {
    if (is.string(filePattern)) {
      return matchRegexOrGlob(file, filePattern);
    }
    // Since filePattern is not a string, it must be a RegExp
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return (filePattern as RegExp).test(file);
  });
  logger.debug(
    `Found ${files.length} files matching pattern ${filePattern} from provided list`,
  );

  // Initialize nodes for all files
  for (const filePath of files) {
    nodes.set(filePath, {
      path: filePath,
      dependencies: [],
      dependents: [],
    });
  }

  // Parse dependencies and build edges
  for (const filePath of files) {
    try {
      const content = await readLocalFile(filePath, 'utf8');

      if (!content) {
        continue;
      }

      const dependencies = parseFileDependencies(filePath, content);
      const node = nodes.get(filePath)!;

      for (const dependency of dependencies) {
        const dependencyPath = resolveDependencyPath(filePath, dependency);

        // Only add edges for dependencies that exist in our graph
        if (dependencyPath && nodes.has(dependencyPath)) {
          node.dependencies.push(dependency);
          edges.push({
            from: filePath,
            to: dependencyPath,
            dependency,
          });
        }
      }
    } catch (error) {
      logger.warn({ filePath, error }, 'Failed to parse file dependencies');
    }
  }

  // Build dependents relationships
  for (const edge of edges) {
    const targetNode = nodes.get(edge.to);
    if (targetNode && !targetNode.dependents.includes(edge.from)) {
      targetNode.dependents.push(edge.from);
    }
  }

  return {
    nodes,
    edges,
  };
}

/**
 * Perform topological sort on the dependency graph
 * Returns nodes in order where dependencies come before dependents
 */
export function topologicalSort<T>(graph: DependencyGraph<T>): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];
  const cycles: CircularDependency[] = [];

  function visit(nodePath: string, path: string[] = []): void {
    if (visited.has(nodePath)) {
      return;
    }

    if (visiting.has(nodePath)) {
      // Detect circular dependency
      const cycleStart = path.indexOf(nodePath);
      const cycle = path.slice(cycleStart);
      cycles.push({
        cycle,
        type: cycle.length === 2 ? 'direct' : 'indirect',
      });
      return;
    }

    visiting.add(nodePath);
    path.push(nodePath);

    const node = graph.nodes.get(nodePath);
    if (node) {
      // Visit dependencies first
      for (const dependency of node.dependencies) {
        const dependencyPath = resolveDependencyPath(
          nodePath,
          dependency,
          graph,
        );
        if (
          dependencyPath &&
          typeof dependencyPath === 'string' &&
          graph.nodes.has(dependencyPath)
        ) {
          visit(dependencyPath, path);
        }
      }
    }

    visiting.delete(nodePath);
    visited.add(nodePath);
    result.push(nodePath);
  }

  // Visit all nodes
  for (const nodePath of graph.nodes.keys()) {
    visit(nodePath);
  }

  if (cycles.length > 0) {
    logger.warn({ cycles }, 'Circular dependencies detected');
  }

  // The result is already in correct order: dependencies before dependents
  return result;
}

/**
 * Find all transitive dependents of a given node
 */
export function getTransitiveDependents<T>(
  graph: DependencyGraph<T>,
  startNode: string,
  options: GraphTraversalOptions = {},
): string[] {
  const { includeSelf = false, maxDepth, direction = 'dependents' } = options;

  const visited = new Set<string>();
  const result: string[] = [];

  function traverse(nodePath: string, depth = 0): void {
    if (visited.has(nodePath)) {
      return;
    }
    if (maxDepth !== undefined && depth > maxDepth) {
      return;
    }

    visited.add(nodePath);

    if (nodePath !== startNode || includeSelf) {
      result.push(nodePath);
    }

    const node = graph.nodes.get(nodePath);
    if (!node) {
      return;
    }

    const targets =
      direction === 'dependents' ? node.dependents : node.dependencies;

    for (const targetPath of targets) {
      if (typeof targetPath === 'string') {
        traverse(targetPath, depth + 1);
      }
    }
  }

  traverse(startNode);
  return result;
}

/**
 * Detect circular dependencies in the graph
 */
export function detectCircularDependencies<T>(
  graph: DependencyGraph<T>,
): CircularDependency[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycles: CircularDependency[] = [];

  function visit(nodePath: string, path: string[] = []): void {
    if (visited.has(nodePath)) {
      return;
    }

    if (visiting.has(nodePath)) {
      const cycleStart = path.indexOf(nodePath);
      const cycle = path.slice(cycleStart);
      cycles.push({
        cycle,
        type: cycle.length === 2 ? 'direct' : 'indirect',
      });
      return;
    }

    visiting.add(nodePath);
    path.push(nodePath);

    const node = graph.nodes.get(nodePath);
    if (node) {
      for (const dependency of node.dependencies) {
        const dependencyPath = resolveDependencyPath(
          nodePath,
          dependency,
          graph,
        );
        if (
          dependencyPath &&
          typeof dependencyPath === 'string' &&
          graph.nodes.has(dependencyPath)
        ) {
          visit(dependencyPath, path);
        }
      }
    }

    visiting.delete(nodePath);
    visited.add(nodePath);
  }

  for (const nodePath of graph.nodes.keys()) {
    visit(nodePath);
  }

  return cycles;
}

// Helper functions
function resolveDependencyPath<T>(
  basePath: string,
  dependency: T,
  graph: DependencyGraph<T>,
): string | null {
  // This is a simplified implementation
  // Each manager should implement proper path resolution
  const node = graph.nodes.get(basePath);
  if (!node) {
    return null;
  }

  // For string dependencies, check if it's already a valid node name
  if (typeof dependency === 'string') {
    // If the dependency string is already a valid node path in the graph, return it directly
    if (graph.nodes.has(dependency)) {
      return dependency;
    }
    // Otherwise, treat it as a relative path
    return upath.resolve(upath.dirname(basePath), dependency);
  }

  return null;
}
