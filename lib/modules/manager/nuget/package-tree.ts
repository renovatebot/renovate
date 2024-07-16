import is from '@sindresorhus/is';
import { Graph } from 'graph-data-structure';
import upath from 'upath';
import { logger } from '../../../logger';
import { minimatchFilter } from '../../../util/minimatch';
import { scm } from '../../platform/scm';
import type { ProjectFile } from './types';
import { readFileAsXmlDocument } from './util';

export const NUGET_CENTRAL_FILE = 'Directory.Packages.props';
export const MSBUILD_CENTRAL_FILE = 'Packages.props';

/**
 * Get all leaf package files of ancestry that depend on packageFileName.
 */
export async function getDependentPackageFiles(
  packageFileName: string,
  isCentralManagement = false,
): Promise<ProjectFile[]> {
  const packageFiles = await getAllPackageFiles();
  const graph: ReturnType<typeof Graph> = Graph();

  if (isCentralManagement) {
    graph.addNode(packageFileName);
  }

  const parentDir =
    packageFileName === NUGET_CENTRAL_FILE ||
    packageFileName === MSBUILD_CENTRAL_FILE
      ? ''
      : upath.dirname(packageFileName);

  for (const f of packageFiles) {
    graph.addNode(f);

    if (isCentralManagement && upath.dirname(f).startsWith(parentDir)) {
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
      .map((pf) => pf.attr['Include'])
      .filter(is.nonEmptyString);

    const projectReferences = projectReferenceAttributes.map((a) =>
      upath.normalize(a),
    );
    const normalizedRelativeProjectReferences = projectReferences.map((r) =>
      reframeRelativePathToRootOfRepo(f, r),
    );

    for (const ref of normalizedRelativeProjectReferences) {
      graph.addEdge(ref, f);
    }

    if (graph.hasCycle()) {
      throw new Error('Circular reference detected in NuGet package files');
    }
  }

  const deps = new Map<string, boolean>();
  recursivelyGetDependentPackageFiles(packageFileName, graph, deps);

  if (isCentralManagement) {
    // remove props file, as we don't need it
    deps.delete(packageFileName);
  }

  // deduplicate
  return Array.from(deps).map(([name, isLeaf]) => ({ name, isLeaf }));
}

/**
 * Traverse graph and find dependent package files at any level of ancestry
 */
function recursivelyGetDependentPackageFiles(
  packageFileName: string,
  graph: ReturnType<typeof Graph>,
  deps: Map<string, boolean>,
): void {
  const dependents = graph.adjacent(packageFileName);

  if (dependents.length === 0) {
    deps.set(packageFileName, true);
    return;
  }

  deps.set(packageFileName, false);

  for (const dep of dependents) {
    recursivelyGetDependentPackageFiles(dep, graph, deps);
  }
}

/**
 * Take the path relative from a project file, and make it relative from the root of the repo
 */
function reframeRelativePathToRootOfRepo(
  dependentProjectRelativePath: string,
  projectReference: string,
): string {
  const virtualRepoRoot = '/';
  const absoluteDependentProjectPath = upath.resolve(
    virtualRepoRoot,
    dependentProjectRelativePath,
  );
  const absoluteProjectReferencePath = upath.resolve(
    upath.dirname(absoluteDependentProjectPath),
    projectReference,
  );
  const relativeProjectReferencePath = upath.relative(
    virtualRepoRoot,
    absoluteProjectReferencePath,
  );

  return relativeProjectReferencePath;
}

/**
 * Get a list of package files in localDir
 */
async function getAllPackageFiles(): Promise<string[]> {
  const allFiles = await scm.getFileList();
  const filteredPackageFiles = allFiles.filter(
    minimatchFilter('*.{cs,vb,fs}proj', { matchBase: true, nocase: true }),
  );

  logger.trace({ filteredPackageFiles }, 'Found package files');

  return filteredPackageFiles;
}
