import { Graph, depthFirstSearch, topologicalSort } from 'graph-data-structure';
import upath from 'upath';
import { scm } from '../../../modules/platform/scm.ts';
import {
  getMatchingFiles,
  readLocalFile,
  resolveRelativePathToRoot,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';

export interface ReplaceDirective {
  oldPath: string;
  newPath: string;
}

// `[^\S\n]` is horizontal whitespace; avoids matches crossing line boundaries.
const singleLineReplace = regEx(
  /^replace[^\S\n]+(\S+)(?:[^\S\n]+\S+)?[^\S\n]+=>[^\S\n]+(\S+)(?:[^\S\n]+\S+)?$/gm,
);
const blockReplace = regEx(/^replace\s*\(([^)]*)\)/gm);
const blockReplaceLine = regEx(/(\S+)(?:[^\S\n]+\S+)?[^\S\n]+=>[^\S\n]+(\S+)/g);

/**
 * Parse local replace directives. Only returns entries whose replacement is a
 * local path (`./foo` or `../foo`).
 */
export function parseReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];
  const push = (m: RegExpExecArray): void => {
    const [, oldPath, newPath] = m;
    if (newPath.startsWith('./') || newPath.startsWith('../')) {
      directives.push({ oldPath, newPath });
    }
  };

  singleLineReplace.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = singleLineReplace.exec(content)) !== null) {
    push(m);
  }

  blockReplace.lastIndex = 0;
  let b: RegExpExecArray | null;
  while ((b = blockReplace.exec(content)) !== null) {
    blockReplaceLine.lastIndex = 0;
    while ((m = blockReplaceLine.exec(b[1])) !== null) {
      push(m);
    }
  }
  return directives;
}

/**
 * Build a dependency graph of all `go.mod` files based on local replace
 * directives. Edge direction is `dependency -> dependent`, matching the NuGet
 * convention so `graph.adjacent(X)` returns modules that depend on `X`.
 */
export async function buildGoModDependencyGraph(): Promise<Graph> {
  const graph = new Graph();
  const files = getMatchingFiles('go.mod', await scm.getFileList());
  const known = new Set(files);
  for (const f of files) {
    graph.addNode(f);
  }

  for (const f of files) {
    const content = await readLocalFile(f, 'utf8');
    if (!content) {
      continue;
    }
    for (const { newPath } of parseReplaceDirectives(content)) {
      const dep = upath.join(resolveRelativePathToRoot(f, newPath), 'go.mod');
      if (known.has(dep)) {
        graph.addEdge(dep, f);
      }
    }
  }
  return graph;
}

/**
 * All `go.mod` files that transitively depend on `target`, in topological
 * order (dependencies before dependents). Excludes `target` itself. Returns
 * an empty array if `target` has no known dependents.
 */
export async function getGoModulesInTidyOrder(
  target: string,
): Promise<string[]> {
  const graph = await buildGoModDependencyGraph();
  if (!graph.adjacent(target)) {
    return [];
  }
  const dependents = new Set(
    depthFirstSearch(graph, {
      sourceNodes: [target],
      includeSourceNodes: false,
    }),
  );
  if (dependents.size === 0) {
    return [];
  }
  return topologicalSort(graph).filter((n) => dependents.has(n));
}
