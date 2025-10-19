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

/**
 * Parse replace directives from go.mod content
 */
export function parseReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];

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

export function resolveGoModulePath(
  baseGoModPath: string,
  replaceDirective: ReplaceDirective,
): string {
  const baseDir = upath.dirname(baseGoModPath);
  const resolvedPath = upath.resolve(baseDir, replaceDirective.newPath);

  return upath.join(resolvedPath, 'go.mod');
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
  fileList: string[],
  rootDir?: string,
): Promise<DependencyGraph<GoModuleDependency>> {
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
