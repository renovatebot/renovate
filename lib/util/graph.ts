import type { Graph } from 'graph-data-structure';

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
