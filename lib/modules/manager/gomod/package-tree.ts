import upath from 'upath';
import { newlineRegex, regEx } from '../../../util/regex';
import {
  buildDependencyGraph,
  getTransitiveDependents,
  topologicalSort,
} from '../../../util/tree';
import type { DependencyGraph } from '../../../util/tree';
import { parseLine } from './line-parser';

/**
 * Interface for Go module replace directive
 */
export interface ReplaceDirective {
  oldPath: string;
  newPath: string;
  version?: string;
}

/**
 * Go module specific dependency information
 */
export interface GoModuleDependency {
  path: string;
  replaceDirective?: ReplaceDirective;
  resolvedPath?: string;
}

export function resolveGoModulePath(
  baseGoModPath: string,
  replaceDirective: ReplaceDirective,
): string {
  const baseDir = upath.dirname(baseGoModPath);
  const resolvedPath = upath.resolve(baseDir, replaceDirective.newPath);

  return upath.join(resolvedPath, 'go.mod');
}

/**
 * Extract replace directives from go.mod content using existing line-parser infrastructure
 */
function extractReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];
  const lines = content.split(newlineRegex);
  let inReplaceBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Handle block start - exactly matching artifacts.ts gomodMassage pattern
    if (trimmedLine.startsWith('replace (')) {
      inReplaceBlock = true;
      continue;
    }

    // Handle block end - exactly matching artifacts.ts gomodMassage pattern
    if (inReplaceBlock && trimmedLine === ')') {
      inReplaceBlock = false;
      continue;
    }

    // Use existing parseLine function to handle replace directives
    const dep = parseLine(line);
    if (
      dep &&
      dep.depType === 'replace' &&
      dep.skipReason === 'local-dependency'
    ) {
      // Extract oldPath from depName (the replacement path)
      // For local replace directives, we need to extract the module being replaced
      const replaceMatch = regEx(
        /^(?:replace\s+)?([^\s]+(?:\s+[^\s]+)*)\s*=>\s+(.+)$/,
      ).exec(line.trim());
      if (replaceMatch) {
        let oldPath = replaceMatch[1].trim();
        const newPath = dep.depName!.replace(/^\.\//, ''); // Remove leading ./ if present

        // For module paths with spaces (like "github.com/hashicorp/consul agent"),
        // extract just the last part as the module identifier
        if (oldPath.includes(' ')) {
          oldPath = oldPath.split(' ').pop() ?? oldPath;
        }

        directives.push({
          oldPath,
          newPath,
          version: dep.currentValue ?? undefined,
        });
      }
    }
  }

  return directives;
}

/**
 * Parse Go module dependencies from go.mod content
 */
export function parseGoModDependencies(
  filePath: string,
  content: string,
): GoModuleDependency[] {
  const directives = extractReplaceDirectives(content);

  return directives
    .map((directive) => {
      const resolvedPath = resolveGoModulePath(filePath, directive);
      return {
        path: directive.oldPath,
        replaceDirective: directive,
        resolvedPath,
      };
    })
    .filter(
      (dep): dep is Required<GoModuleDependency> & { resolvedPath: string } =>
        !!dep.resolvedPath && !!dep.replaceDirective,
    );
}

/**
 * Resolve dependency path for Go modules
 */
function resolveGoDependencyPath(
  _basePath: string,
  dependency: GoModuleDependency,
): string {
  return dependency.resolvedPath!;
}

/**
 * Build Go module dependency graph
 * If targetModulePath is provided, builds a focused graph starting from that module
 * This is more efficient for large monorepos where only a subset of modules are affected
 */
export async function buildGoModDependencyGraph(
  fileList: string[],
  rootDir?: string,
  targetModulePath?: string,
): Promise<DependencyGraph<GoModuleDependency>> {
  // If target module is specified, build focused graph
  if (targetModulePath) {
    // First, get all modules that could potentially depend on the target
    const transitiveDependents = await getTransitiveDependentModules(
      targetModulePath,
      fileList,
    );

    // Include the target module itself and all its transitive dependents
    const relevantModules = [targetModulePath, ...transitiveDependents];

    // Build the dependency graph using only the relevant modules
    const graph = await buildDependencyGraph<GoModuleDependency>({
      filePattern: '/(^|/)go\\.mod$/',
      parseFileDependencies: parseGoModDependencies,
      resolveDependencyPath: resolveGoDependencyPath,
      rootDir,
      fileList: relevantModules,
    });

    // Store the relevant modules info for debugging
    (graph as any).relevantModules = relevantModules;
    return graph;
  }

  // Original behavior when no target module specified
  return await buildDependencyGraph<GoModuleDependency>({
    filePattern: '/(^|/)go\\.mod$/',
    parseFileDependencies: parseGoModDependencies,
    resolveDependencyPath: resolveGoDependencyPath,
    rootDir,
    fileList,
  });
}

/**
 * Get all modules that depend on a specific module (transitively)
 */
export async function getTransitiveDependentModules(
  targetModulePath: string,
  fileList: string[],
): Promise<string[]> {
  const graph = await buildGoModDependencyGraph(fileList);
  return getTransitiveDependents(graph, targetModulePath, {
    includeSelf: false,
    direction: 'dependents',
  });
}

/**
 * Get modules in dependency order for sequential processing
 */
export async function getGoModulesInDependencyOrder(
  fileList: string[],
): Promise<string[]> {
  const graph = await buildGoModDependencyGraph(fileList);
  return topologicalSort(graph);
}

/**
 * Get the module name from go.mod content
 */
export function getModuleName(content: string): string | null {
  const match = regEx(/^module\s+([^\s]+)/m).exec(content);
  return match ? match[1] : null;
}
