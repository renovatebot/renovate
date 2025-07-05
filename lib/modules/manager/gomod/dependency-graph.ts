import { logger } from '../../../logger';
import { readLocalFile, findLocalSiblingOrParent } from '../../../util/fs';
import upath from 'upath';
import { extractPackageFile } from './extract';

export interface ReplaceDirective {
  from: string;
  to: string;
  isLocal: boolean;
  localPath?: string;
}

export interface GoModuleDependency {
  modulePath: string;
  replaceDirectives: ReplaceDirective[];
  indirectDependencies: string[];
}

export interface DependencyGraph {
  modules: Map<string, GoModuleDependency>;
  dependents: Map<string, string[]>; // module -> list of modules that depend on it
}

/**
 * Extracts replace directives from a go.mod file
 */
function extractReplaceDirectives(content: string): ReplaceDirective[] {
  const directives: ReplaceDirective[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('replace ')) {
      // Handle single line replace: replace old => new
      const match = trimmed.match(/^replace\s+([^\s]+)\s*=>\s*([^\s]+)(?:\s+([^\s]+))?$/);
      if (match) {
        const [, from, to, version] = match;
        const isLocal = to.startsWith('./') || to.startsWith('../') || to.startsWith('/');
        directives.push({
          from,
          to,
          isLocal,
          localPath: isLocal ? to : undefined,
        });
      }
    } else if (trimmed.startsWith('replace (')) {
      // Handle multi-line replace block
      let inReplaceBlock = true;
      let i = lines.indexOf(line) + 1;

      while (inReplaceBlock && i < lines.length) {
        const blockLine = lines[i].trim();
        if (blockLine === ')') {
          inReplaceBlock = false;
        } else if (blockLine && !blockLine.startsWith('//')) {
          const match = blockLine.match(/^([^\s]+)\s*=>\s*([^\s]+)(?:\s+([^\s]+))?$/);
          if (match) {
            const [, from, to, version] = match;
            const isLocal = to.startsWith('./') || to.startsWith('../') || to.startsWith('/');
            directives.push({
              from,
              to,
              isLocal,
              localPath: isLocal ? to : undefined,
            });
          }
        }
        i++;
      }
    }
  }

  return directives;
}

/**
 * Builds a dependency graph for Go modules in the repository
 */
export async function buildDependencyGraph(
  baseDir: string,
  goModFiles: string[],
): Promise<DependencyGraph> {
  const modules = new Map<string, GoModuleDependency>();
  const dependents = new Map<string, string[]>();

  logger.debug('Building Go module dependency graph');

  // First pass: extract all modules and their replace directives
  for (const goModFile of goModFiles) {
    const content = await readLocalFile(goModFile, 'utf8');
    if (!content) {
      continue;
    }

    const moduleDir = upath.dirname(goModFile);
    const replaceDirectives = extractReplaceDirectives(content);

    // Extract module name from go.mod content
    const moduleMatch = content.match(/^module\s+([^\s]+)/m);
    const moduleName = moduleMatch?.[1];

    if (moduleName) {
      modules.set(moduleName, {
        modulePath: moduleDir,
        replaceDirectives,
        indirectDependencies: [],
      });

      // Initialize dependents map
      dependents.set(moduleName, []);
    }
  }

  // Second pass: build dependency relationships
  for (const [moduleName, moduleInfo] of modules) {
    for (const directive of moduleInfo.replaceDirectives) {
      if (directive.isLocal && directive.localPath) {
        // Find the actual module this local path points to
        const resolvedPath = upath.resolve(moduleInfo.modulePath, directive.localPath);
        const targetGoMod = await findLocalSiblingOrParent(resolvedPath, 'go.mod');

        if (targetGoMod) {
          const targetContent = await readLocalFile(targetGoMod, 'utf8');
          if (targetContent) {
            const targetModuleMatch = targetContent.match(/^module\s+([^\s]+)/m);
            const targetModuleName = targetModuleMatch?.[1];

            if (targetModuleName && targetModuleName !== moduleName) {
              // Add dependency relationship
              const currentDependents = dependents.get(targetModuleName) || [];
              if (!currentDependents.includes(moduleName)) {
                currentDependents.push(moduleName);
                dependents.set(targetModuleName, currentDependents);
              }

              logger.debug(
                { from: moduleName, to: targetModuleName, directive },
                'Found module dependency relationship',
              );
            }
          }
        }
      }
    }
  }

  return { modules, dependents };
}

/**
 * Finds all modules that depend on the given module
 */
export function findDependentModules(
  graph: DependencyGraph,
  moduleName: string,
): string[] {
  return graph.dependents.get(moduleName) || [];
}

/**
 * Checks if a module has any local replace directives
 */
export function hasLocalReplaceDirectives(
  graph: DependencyGraph,
  moduleName: string,
): boolean {
  const module = graph.modules.get(moduleName);
  return module?.replaceDirectives.some(d => d.isLocal) ?? false;
}