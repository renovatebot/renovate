import upath from 'upath';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import {
  buildDependencyGraph,
  getTransitiveDependents,
  groupByDependencyLevel,
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
 * Find all go.mod files in the repository
 */
export async function getAllGoModFiles(
  rootDir: string = process.cwd(),
): Promise<string[]> {
  try {
    const { globby } = await import('globby');
    const files = await globby('**/go.mod', {
      cwd: rootDir,
      absolute: true,
      gitignore: true,
    });
    return files;
  } catch (error) {
    logger.error({ error }, 'Failed to find go.mod files');
    return [];
  }
}

/**
 * Parse replace directives from go.mod content
 */
export function parseReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];

  // Match single-line replace directives
  const singleLineRegex = regEx(
    /^replace\s+([^\s]+)\s+(?:=>\s+([^\s]+)|([^\s]+\s+)=>\s+(.+))$/gm,
  );

  let match;
  while ((match = singleLineRegex.exec(content)) !== null) {
    const [, oldPath, newPath] = match;
    if (newPath && (newPath.startsWith('./') || newPath.startsWith('../'))) {
      directives.push({
        oldPath,
        newPath: newPath.replace(/^\.\//, ''),
      });
    }
  }

  // Match multi-line replace blocks
  const blockRegex = regEx(/replace\s*\(\s*([^)]+)\s*\)/s);
  const blockMatch = blockRegex.exec(content);

  if (blockMatch) {
    const blockContent = blockMatch[1];
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
      (dep): dep is GoModuleDependency & { resolvedPath: string } =>
        !!dep.resolvedPath,
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
  rootDir?: string,
): Promise<DependencyGraph<GoModuleDependency>> {
  return buildDependencyGraph<GoModuleDependency>({
    filePattern: '**/go.mod',
    parseFileDependencies: parseGoModDependencies,
    resolveDependencyPath: resolveGoDependencyPath,
    rootDir,
  });
}

/**
 * Get all modules that depend on a specific module (transitively)
 */
export async function getTransitiveDependentModules(
  targetModulePath: string,
  rootDir?: string,
): Promise<string[]> {
  const graph = await buildGoModDependencyGraph(rootDir);
  return getTransitiveDependents(graph, targetModulePath, {
    includeSelf: false,
    direction: 'dependents',
  });
}

/**
 * Get modules in dependency order for batch processing
 */
export async function getGoModulesInDependencyOrder(
  rootDir?: string,
): Promise<string[][]> {
  const graph = await buildGoModDependencyGraph(rootDir);
  const sortedNodes = topologicalSort(graph);
  return groupByDependencyLevel(sortedNodes);
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
