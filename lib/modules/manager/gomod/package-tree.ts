import { Graph, hasCycle } from 'graph-data-structure';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { scm } from '../../platform/scm';

export interface GoModuleFile {
  name: string;
  isLeaf: boolean;
}

const replaceRegex = regEx(
  /^replace\s+(?<module>[^\s]+)\s*=>\s*(?<replacement>[^\s]+)(?:\s+(?<version>[^\s]+))?(?:\s*\/\/.*)?$/,
);

/**
 * Get all dependent go.mod files that need to be updated when packageFileName changes
 */
export async function getDependentGoModFiles(
  packageFileName: string,
): Promise<GoModuleFile[]> {
  const goModFiles = await getAllGoModFiles();
  const graph = new Graph();

  for (const f of goModFiles) {
    graph.addNode(f);
  }

  for (const f of goModFiles) {
    const replaceDirectives = await parseLocalReplaceDirectives(f);

    for (const directive of replaceDirectives) {
      const referencedGoMod = directive.targetGoModPath;
      // Only add edges for files that exist in our go.mod files list
      if (referencedGoMod && goModFiles.includes(referencedGoMod)) {
        // Create dependency edge: f depends on referencedGoMod
        graph.addEdge(referencedGoMod, f);
      }
    }
  }

  if (hasCycle(graph)) {
    logger.warn('Circular reference detected in Go modules replace directives');
    return [];
  }

  const deps = new Map<string, boolean>();
  recursivelyGetDependentGoModFiles(packageFileName, graph, deps);

  // deduplicate
  return Array.from(deps).map(([name, isLeaf]) => ({ name, isLeaf }));
}

/**
 * Traverse graph and find dependent go.mod files at any level of ancestry
 */
function recursivelyGetDependentGoModFiles(
  packageFileName: string,
  graph: Graph,
  deps: Map<string, boolean>,
): void {
  if (deps.has(packageFileName)) {
    // we have already visited this package file
    return;
  }

  const dependents = graph.adjacent(packageFileName);

  if (!dependents || dependents.size === 0) {
    deps.set(packageFileName, true);
    return;
  }

  deps.set(packageFileName, false);

  for (const dep of dependents) {
    recursivelyGetDependentGoModFiles(dep, graph, deps);
  }
}

/**
 * Parse local replace directives from a go.mod file
 */
async function parseLocalReplaceDirectives(
  goModFile: string,
): Promise<{ targetGoModPath: string | null }[]> {
  const content = await readLocalFile(goModFile, 'utf8');
  if (!content) {
    return [];
  }

  const directives: { targetGoModPath: string | null }[] = [];
  const lines = content.split(newlineRegex);
  const blockRegex = regEx(
    /^\s*(?<module>[^\s]+)\s*=>\s*(?<replacement>[^\s]+)(?:\s+(?<version>[^\s]+))?(?:\s*\/\/.*)?$/,
  );
  let inReplaceBlock = false;
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if we're starting a multiline replace block
    if (trimmedLine.startsWith('replace (')) {
      inReplaceBlock = true;
      continue;
    }

    // Check if we're ending a multiline replace block
    if (inReplaceBlock && trimmedLine === ')') {
      inReplaceBlock = false;
      continue;
    }

    // Parse replace directive (either single line or inside multiline block)
    let replaceMatches = replaceRegex.exec(line)?.groups;

    // For multiline blocks, the keyword might be missing
    if (inReplaceBlock && !replaceMatches) {
      // Try parsing without the replace keyword
      replaceMatches = blockRegex.exec(line)?.groups;
    }

    if (replaceMatches) {
      const { replacement } = replaceMatches;
      const depName = trimQuotes(replacement);

      // Only process local dependencies (relative paths)
      if (depName.startsWith('./') || depName.startsWith('../')) {
        const targetGoModPath = reframeRelativePathToRootOfRepo(
          goModFile,
          depName,
        );
        const targetGoModFile = upath.join(targetGoModPath, 'go.mod');
        directives.push({ targetGoModPath: targetGoModFile });
      }
    }
  }

  return directives;
}

/**
 * Take the path relative from a go.mod file, and make it relative from the root of the repo
 */
function reframeRelativePathToRootOfRepo(
  dependentGoModRelativePath: string,
  replaceReference: string,
): string {
  const virtualRepoRoot = '/';
  const absoluteDependentGoModPath = upath.resolve(
    virtualRepoRoot,
    dependentGoModRelativePath,
  );
  const absoluteReplaceReferencePath = upath.resolve(
    upath.dirname(absoluteDependentGoModPath),
    replaceReference,
  );
  const relativeReplaceReferencePath = upath.relative(
    virtualRepoRoot,
    absoluteReplaceReferencePath,
  );

  return relativeReplaceReferencePath;
}

/**
 * Get a list of go.mod files in the repository
 */
async function getAllGoModFiles(): Promise<string[]> {
  const allFiles = await scm.getFileList();
  const filteredGoModFiles = allFiles.filter((file) => file.endsWith('go.mod'));

  logger.trace({ filteredGoModFiles }, 'Found go.mod files');

  return filteredGoModFiles;
}

function trimQuotes(str: string): string {
  return str.replace(regEx(/^"(.*)"$/), '$1');
}
