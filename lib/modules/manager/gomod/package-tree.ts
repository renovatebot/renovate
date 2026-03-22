import { Graph, topologicalSort } from 'graph-data-structure';
import upath from 'upath';
import { readLocalFile } from '../../../util/fs/index.ts';
import {
  getMatchingFiles,
  getTransitiveDependents,
  resolveRelativePathToRoot,
} from '../../../util/graph.ts';
import { regEx } from '../../../util/regex.ts';

export interface ReplaceDirective {
  oldPath: string;
  newPath: string;
}

/**
 * Parse local replace directives from go.mod content.
 * Only returns directives where the replacement is a local path (./ or ../).
 */
export function parseReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];

  // Match single-line: replace old => ./local
  // Use [^\S\n] instead of \s to avoid matching across line boundaries
  const singleLineRegex = regEx(
    /^replace[^\S\n]+(\S+)(?:[^\S\n]+\S+)?[^\S\n]+=>[^\S\n]+(\S+)(?:[^\S\n]+\S+)?$/gm,
  );
  let match;
  while ((match = singleLineRegex.exec(content)) !== null) {
    const [, oldPath, newPath] = match;
    if (newPath.startsWith('./') || newPath.startsWith('../')) {
      directives.push({ oldPath, newPath });
    }
  }

  // Match multi-line replace blocks: replace ( ... )
  const blockRegex = regEx(/^replace\s*\(([^)]*)\)/gm);
  let blockMatch;
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const blockContent = blockMatch[1];
    // Use [^\S\n] to avoid matching across lines
    const lineRegex = regEx(/(\S+)(?:[^\S\n]+\S+)?[^\S\n]+=>[^\S\n]+(\S+)/g);
    while ((match = lineRegex.exec(blockContent)) !== null) {
      const [, oldPath, newPath] = match;
      if (newPath.startsWith('./') || newPath.startsWith('../')) {
        directives.push({ oldPath, newPath });
      }
    }
  }

  return directives;
}

/**
 * Resolve a replace directive's local path to a repo-relative go.mod path.
 */
export function resolveGoModulePath(
  baseGoModPath: string,
  directive: ReplaceDirective,
): string {
  const resolvedDir = resolveRelativePathToRoot(
    baseGoModPath,
    directive.newPath,
  );
  return upath.join(resolvedDir, 'go.mod');
}

/**
 * Build a dependency graph of all go.mod files based on local replace directives.
 * Edge direction: addEdge(dependency, dependent) — same as NuGet convention.
 * So graph.adjacent(X) returns all modules that depend on X.
 */
export async function buildGoModDependencyGraph(): Promise<Graph> {
  const graph = new Graph();

  const goModFiles = await getMatchingFiles('go.mod');

  for (const goModFile of goModFiles) {
    graph.addNode(goModFile);
  }

  const goModSet = new Set(goModFiles);

  for (const goModFile of goModFiles) {
    const content = await readLocalFile(goModFile, 'utf8');
    if (!content) {
      continue;
    }

    const directives = parseReplaceDirectives(content);
    for (const directive of directives) {
      const depGoMod = resolveGoModulePath(goModFile, directive);
      if (goModSet.has(depGoMod)) {
        // Edge: dependency -> dependent (so adjacent(dep) gives dependents)
        graph.addEdge(depGoMod, goModFile);
      }
    }
  }

  return graph;
}

/**
 * Get all go.mod files that transitively depend on the target module,
 * sorted in topological order (dependencies before dependents).
 * Does NOT include the target module itself.
 */
export async function getGoModulesInTidyOrder(
  targetModulePath: string,
): Promise<string[]> {
  const graph = await buildGoModDependencyGraph();

  if (!graph.adjacent(targetModulePath)) {
    return [];
  }

  const deps = getTransitiveDependents(graph, targetModulePath);

  // Remove the target module itself
  deps.delete(targetModulePath);

  if (deps.size === 0) {
    return [];
  }

  // Get topological order of the full graph, then filter to only our dependents
  const sorted = topologicalSort(graph);
  const dependentSet = new Set(deps.keys());

  return sorted.filter((node) => dependentSet.has(node));
}

/**
 * Check if a go.mod has local replace directives.
 */
export function hasLocalReplaceDirectives(content: string): boolean {
  return parseReplaceDirectives(content).length > 0;
}

/**
 * Extract the module name from go.mod content.
 */
export function getModuleName(content: string): string | null {
  const match = regEx(/^module\s+(\S+)/m).exec(content);
  return match?.[1] ?? null;
}
