import path from 'path';
import util from 'util';
import { glob } from 'glob';
import Graph from 'graph-data-structure';
import upath from 'upath';
import xmldoc from 'xmldoc';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { regEx } from '../../util/regex';

const globAsync = util.promisify(glob);

// Get all package files at any level of ancestry that depend on `packageFileName`
export async function getDependentPackageFiles(
  packageFileName: string
): Promise<string[]> {
  const packageFiles = await getAllPackageFiles();
  const graph: ReturnType<typeof Graph> = Graph();

  for (const f of packageFiles) {
    graph.addNode(f);
  }

  for (const f of packageFiles) {
    const packageFileContent = (await readLocalFile(f, 'utf8')).toString();

    const doc = new xmldoc.XmlDocument(packageFileContent);
    const projectReferenceAttributes = (
      doc
        .childrenNamed('ItemGroup')
        .map((ig) => ig.childrenNamed('ProjectReference')) ?? []
    )
      .flat()
      .map((pf) => pf.attr['Include']);

    logger.debug(projectReferenceAttributes);
    const projectReferences = projectReferenceAttributes.map((a) =>
      upath.normalize(a)
    );
    const normalizedRelativeProjectReferences = projectReferences.map((r) =>
      normalizeRelativePath(f, r)
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
  graph: ReturnType<typeof Graph>
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
  fromPackageFile: string,
  toPackageFile: string
): string {
  const fromFullPath = `/${fromPackageFile}`;
  const toFullPath = path.resolve(path.dirname(fromFullPath), toPackageFile);
  const relativeToPackageFile = path.relative('/', toFullPath);

  return relativeToPackageFile;
}

// Get a list of package files in `localDir`
async function getAllPackageFiles(): Promise<string[]> {
  const possiblePackageFiles = await globLocalFiles('**/*proj');
  const filteredPackageFiles = possiblePackageFiles.filter((f) =>
    regEx(/(?:cs|vb|fs)proj$/i).test(f)
  );

  logger.debug({ filteredPackageFiles }, 'Found package files');

  return filteredPackageFiles;
}

async function globLocalFiles(globPattern: string): Promise<string[]> {
  const { localDir } = GlobalConfig.get();
  const globbedFiles = await globAsync(upath.join(localDir, globPattern));
  const relativeFiles = globbedFiles.map((f) =>
    upath.relative(localDir ?? '', f)
  );
  return relativeFiles;
}
