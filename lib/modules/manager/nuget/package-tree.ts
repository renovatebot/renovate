import { isNonEmptyString } from '@sindresorhus/is';
import { Graph, hasCycle } from 'graph-data-structure';
import upath from 'upath';
import { scm } from '../../../modules/platform/scm.ts';
import {
  getMatchingFiles,
  resolveRelativePathToRoot,
} from '../../../util/fs/index.ts';
import type { ProjectFile } from './types.ts';
import { readFileAsXmlDocument } from './util.ts';

export const GLOBAL_JSON = 'global.json';
export const NUGET_CENTRAL_FILE = 'Directory.Packages.props';
export const MSBUILD_CENTRAL_FILE = 'Packages.props';

/**
 * Get all leaf package files of ancestry that depend on packageFileName.
 */
export async function getDependentPackageFiles(
  packageFileName: string,
  isCentralManagement = false,
  isGlobalJson = false,
): Promise<ProjectFile[]> {
  const packageFiles = getMatchingFiles(
    '*.{cs,vb,fs}proj',
    await scm.getFileList(),
  );
  const graph = new Graph();

  if (isCentralManagement) {
    graph.addNode(packageFileName);
  }

  if (isGlobalJson) {
    graph.addNode(GLOBAL_JSON);
  }

  const parentDir =
    packageFileName === NUGET_CENTRAL_FILE ||
    packageFileName === MSBUILD_CENTRAL_FILE ||
    packageFileName === GLOBAL_JSON
      ? ''
      : upath.dirname(packageFileName);

  for (const f of packageFiles) {
    graph.addNode(f);

    if (
      (isCentralManagement || isGlobalJson) &&
      upath.dirname(f).startsWith(parentDir)
    ) {
      graph.addEdge(packageFileName, f);
    }
  }

  for (const f of packageFiles) {
    const doc = await readFileAsXmlDocument(f);
    if (!doc) {
      continue;
    }

    const projectReferences = doc
      .childrenNamed('ItemGroup')
      .flatMap((ig) => ig.childrenNamed('ProjectReference'))
      .map((pf) => pf.attr.Include)
      .filter(isNonEmptyString)
      .map((a) => resolveRelativePathToRoot(f, upath.normalize(a)));

    for (const ref of projectReferences) {
      graph.addEdge(ref, f);
    }

    if (hasCycle(graph)) {
      throw new Error('Circular reference detected in NuGet package files');
    }
  }

  const visited = new Map<string, boolean>();
  collectDependents(packageFileName, graph, visited);

  if (isCentralManagement || isGlobalJson) {
    // remove props file, as we don't need it
    visited.delete(packageFileName);
  }

  return Array.from(visited).map(([name, isLeaf]) => ({ name, isLeaf }));
}

/**
 * Pre-order DFS, marking each visited node with isLeaf=true when it has
 * no further dependents.
 */
function collectDependents(
  node: string,
  graph: Graph,
  visited: Map<string, boolean>,
): void {
  if (visited.has(node)) {
    return;
  }
  const dependents = graph.adjacent(node);
  if (!dependents || dependents.size === 0) {
    visited.set(node, true);
    return;
  }
  visited.set(node, false);
  for (const dependent of dependents) {
    collectDependents(dependent, graph, visited);
  }
}
