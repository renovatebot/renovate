import type { Graph } from 'graph-data-structure';
import upath from 'upath';
import { scm } from '../modules/platform/scm.ts';
import { minimatchFilter } from './minimatch.ts';

/**
 * Find all nodes transitively reachable from startNode via adjacent edges.
 * Returns a Map where key is the node path and value is whether it's a leaf
 * (has no further adjacent nodes).
 *
 * This is a shared utility used by both NuGet and Go module managers.
 */
export function getTransitiveDependents(
  graph: Graph,
  startNode: string,
): Map<string, boolean> {
  const deps = new Map<string, boolean>();
  collectDependents(graph, startNode, deps);
  return deps;
}

function collectDependents(
  graph: Graph,
  node: string,
  deps: Map<string, boolean>,
): void {
  if (deps.has(node)) {
    return;
  }

  const adjacentNodes = graph.adjacent(node);

  if (!adjacentNodes || adjacentNodes.size === 0) {
    deps.set(node, true);
    return;
  }

  deps.set(node, false);

  for (const dep of adjacentNodes) {
    collectDependents(graph, dep, deps);
  }
}

/**
 * Take a relative path reference from a repo-relative file and resolve it
 * to a repo-relative path. Uses a virtual root to avoid upath.resolve
 * prepending the real cwd for relative paths.
 *
 * Shared between NuGet (ProjectReference) and Go (replace directive) managers.
 */
export function resolveRelativePathToRoot(
  baseFilePath: string,
  relativePath: string,
): string {
  const virtualRoot = '/';
  const absoluteBase = upath.resolve(virtualRoot, baseFilePath);
  const absoluteResolved = upath.resolve(
    upath.dirname(absoluteBase),
    relativePath,
  );
  return upath.relative(virtualRoot, absoluteResolved);
}

/**
 * Get a list of files in the repository matching a minimatch filter pattern.
 * Shared between managers for building dependency graphs from specific file types.
 */
export async function getMatchingFiles(pattern: string): Promise<string[]> {
  const allFiles = await scm.getFileList();
  return allFiles.filter(
    minimatchFilter(pattern, { matchBase: true, nocase: true }),
  );
}
