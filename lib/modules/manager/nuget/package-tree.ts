import { isNonEmptyString } from '@sindresorhus/is';
import { Graph, hasCycle } from 'graph-data-structure';
import upath from 'upath';
import { getTransitiveDependents } from '../../../util/graph.ts';
import {
  getMatchingFiles,
  resolveRelativePathToRoot,
} from '../../../util/tree.ts';
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
  const packageFiles = await getMatchingFiles('*.{cs,vb,fs}proj');
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

    const projectReferenceAttributes = doc
      .childrenNamed('ItemGroup')
      .map((ig) => ig.childrenNamed('ProjectReference'))
      .flat()
      .map((pf) => pf.attr.Include)
      .filter(isNonEmptyString);

    const projectReferences = projectReferenceAttributes.map((a) =>
      upath.normalize(a),
    );
    const normalizedRelativeProjectReferences = projectReferences.map((r) =>
      resolveRelativePathToRoot(f, r),
    );

    for (const ref of normalizedRelativeProjectReferences) {
      graph.addEdge(ref, f);
    }

    if (hasCycle(graph)) {
      throw new Error('Circular reference detected in NuGet package files');
    }
  }

  const deps = getTransitiveDependents(graph, packageFileName);

  if (isCentralManagement || isGlobalJson) {
    // remove props file, as we don't need it
    deps.delete(packageFileName);
  }

  // deduplicate
  return Array.from(deps).map(([name, isLeaf]) => ({ name, isLeaf }));
}
