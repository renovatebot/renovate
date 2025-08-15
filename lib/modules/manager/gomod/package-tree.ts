import { Graph, hasCycle } from 'graph-data-structure';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { minimatchFilter } from '../../../util/minimatch';
import { newlineRegex, regEx } from '../../../util/regex';
import {
  convertTraversalMapToResults,
  recursivelyTraverseGraph,
  reframeRelativePathToRootOfRepo,
} from '../../../util/tree';
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
export async function getTransitiveDependentModules(
  packageFileName: string,
): Promise<GoModuleFile[]> {
  const goModFiles = await getAllGoModFiles();

  // If the target file doesn't exist in the repository, return empty
  if (!goModFiles.includes(packageFileName)) {
    return [];
  }

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

  const visitedModules = new Map<string, boolean>();
  recursivelyTraverseGraph(packageFileName, graph, visitedModules);

  // Convert to the expected format
  return convertTraversalMapToResults(visitedModules).map(
    ({ node, isLeaf }) => ({ name: node, isLeaf }),
  );
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
 * Get a list of go.mod files in the repository
 */
async function getAllGoModFiles(): Promise<string[]> {
  const allFiles = await scm.getFileList();
  const filteredGoModFiles = allFiles.filter(
    minimatchFilter('go.mod', { matchBase: true, nocase: true }),
  );

  logger.trace({ filteredGoModFiles }, 'Found go.mod files');

  return filteredGoModFiles;
}

function trimQuotes(str: string): string {
  return str.replace(regEx(/^"(.*)"$/), '$1');
}
