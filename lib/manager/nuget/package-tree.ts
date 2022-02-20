import path from 'path';
import util from 'util';
import { glob } from 'glob';
import Graph from 'graph-data-structure';
import upath from 'upath';
import { DOMParser as dom } from 'xmldom';
import xpath from 'xpath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { regEx } from '../../util/regex';

const globAsync = util.promisify(glob);

// Get all package files at any level of ancestry that depend on `packageFileName`
export async function getDependentPackageFiles(
  packageFileName: string
): Promise<string[]> {
  const { localDir } = GlobalConfig.get();
  if (localDir === undefined) {
    throw new Error('localDir must be set');
  }
  const packageFiles = await getAllPackageFiles(localDir);
  const graph: any = Graph();

  for (const f of packageFiles) {
    graph.addNode(f);
  }

  for (const f of packageFiles) {
    const packageFileContent = (await readLocalFile(f, 'utf8')).toString();

    const doc = new dom().parseFromString(packageFileContent);
    const projectReferenceAttributes = xpath.select(
      '//ProjectReference/@Include',
      doc
    );
    const projectReferences = projectReferenceAttributes.map((a) =>
      upath.normalize((a as Attr).value)
    );
    const normalizedRelativeProjectReferences = projectReferences.map((r) =>
      normalizeRelativePath(localDir, f, r)
    );

    for (const ref of normalizedRelativeProjectReferences) {
      graph.addEdge(ref, f);
    }

    if (graph.hasCycle()) {
      throw new Error('Circular reference detected in NuGet package files');
    }
  }

  return recursivelyGetDependentPackageFiles(packageFileName, graph);
}

// Traverse graph and find dependent package files at any level of ancestry
function recursivelyGetDependentPackageFiles(
  packageFileName: string,
  graph: any
): string[] {
  const dependents: string[] = graph.adjacent(packageFileName);

  if (dependents.length === 0) {
    return [];
  }

  return dependents.concat(
    dependents.map((d) => recursivelyGetDependentPackageFiles(d, graph)).flat()
  );
}

// Take the path relative from a package file, and make it relative from the root of the repo
function normalizeRelativePath(
  localDir: string,
  fromPackageFile: string,
  toPackageFile: string
): string {
  const fromFullPath = `${localDir}/${fromPackageFile}`;
  const toFullPath = path.resolve(path.dirname(fromFullPath), toPackageFile);
  const relativeToPackageFile = path.relative(localDir, toFullPath);

  return relativeToPackageFile;
}

// Get a list of package files in `localDir`
async function getAllPackageFiles(localDir: string): Promise<string[]> {
  const possiblePackageFiles = await globAsync(`${localDir}/**/*proj`);
  const filteredPackageFiles = possiblePackageFiles.filter((f) =>
    regEx(/(?:cs|vb|fs)proj$/i).test(f)
  );
  const relativePackageFiles = filteredPackageFiles.map((f) =>
    f.substring(localDir.length + 1)
  );

  logger.debug({ relativePackageFiles }, 'Found package files');

  return relativePackageFiles;
}
