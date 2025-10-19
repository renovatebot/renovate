import upath from 'upath';
import { regEx } from '../../../util/regex';
import {
  buildDependencyGraph,
  getTransitiveDependents,
  topologicalSort,
} from '../../../util/tree';
import type { DependencyGraph } from '../../../util/tree';

/**
 * Interface for Go module replace directive
 */
export interface ReplaceDirective {
  /**
   * The original module path being replaced
   */
  oldPath: string;
  /**
   * The local path to replace it with
   */
  newPath: string;
  /**
   * The version constraint (optional)
   */
  version?: string;
}

/**
 * Go module specific dependency information
 */
export interface GoModuleDependency {
  /**
   * The module path
   */
  path: string;
  /**
   * The replace directive information
   */
  replaceDirective?: ReplaceDirective;
  /**
   * The resolved path to the go.mod file
   */
  resolvedPath?: string;
}

/**
 * Parse replace directives from go.mod content
 * Reuses the same logic as in artifacts.ts for consistency
 */
export function parseReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];

  // Match single-line replace directives (same as artifacts.ts)
  const singleLineRegex = regEx(
    /(\r?\n)replace\s+([^\s]+)\s+(?:=>\s+([^\s]+)|([^\s]+\s+)=>\s+(.+))/g,
  );

  let match;
  while ((match = singleLineRegex.exec(content)) !== null) {
    const [, , oldPath, newPath] = match;
    if (newPath && (newPath.startsWith('./') || newPath.startsWith('../'))) {
      directives.push({
        oldPath,
        newPath: newPath.replace(/^\.\//, ''),
      });
    }
  }

  // Match multi-line replace blocks (same as artifacts.ts)
  const blockRegex = regEx(/(\r?\n)replace\s*\(\s*([^)]+)\s*\)/s);
  const blockMatch = blockRegex.exec(content);

  if (blockMatch) {
    const blockContent = blockMatch[2];
    const lineRegex = regEx(/([^\s]+)\s+=>\s+([^\s]+)/g);

    while ((match = lineRegex.exec(blockContent)) !== null) {
      const [, oldPath, newPath] = match;
      if (newPath.startsWith('./') || newPath.startsWith('../')) {
        directives.push({
          oldPath,
          newPath: newPath.replace(/^\.\//, ''),
        });
      }
    }
  }

  return directives;
}

/**
 * Resolve the absolute path of a Go module from a replace directive
 */
export function resolveGoModulePath(
  baseGoModPath: string,
  replaceDirective: ReplaceDirective,
): string {
  const baseDir = upath.dirname(baseGoModPath);
  const resolvedPath = upath.resolve(baseDir, replaceDirective.newPath);

  // Check if the resolved path contains a go.mod file
  const goModPath = upath.join(resolvedPath, 'go.mod');
  return goModPath;
}

/**
 * Parse Go module dependencies from go.mod content
 */
export function parseGoModDependencies(
  filePath: string,
  content: string,
): GoModuleDependency[] {
  const replaceDirectives = parseReplaceDirectives(content);

  return replaceDirectives
    .map((directive) => {
      const resolvedPath = resolveGoModulePath(filePath, directive);
      return {
        path: directive.oldPath,
        replaceDirective: directive,
        // The actual dependency path for graph building is the resolved go.mod path
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
 */
export async function buildGoModDependencyGraph(
  fileList: string[], // Pass discovered go.mod files
  rootDir?: string,
): Promise<DependencyGraph<GoModuleDependency>> {
  return await buildDependencyGraph<GoModuleDependency>({
    filePattern: '/(^|/)go\\.mod$/', // Use the same pattern as managerFilePatterns
    parseFileDependencies: parseGoModDependencies,
    resolveDependencyPath: resolveGoDependencyPath,
    rootDir,
    fileList, // Use the provided files
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
 * Check if a module has local replace directives
 */
export function hasLocalReplaceDirectives(content: string): boolean {
  const directives = parseReplaceDirectives(content);
  return directives.some(
    (directive) =>
      directive.newPath.startsWith('./') || directive.newPath.startsWith('../'),
  );
}

/**
 * Get the module name from go.mod content
 */
export function getModuleName(content: string): string | null {
  const match = regEx(/^module\s+([^\s]+)/m).exec(content);
  return match ? match[1] : null;
}
