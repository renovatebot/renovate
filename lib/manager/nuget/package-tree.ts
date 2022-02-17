import glob from 'glob';
import { GlobalConfig } from '../../config/global';
import Graph from 'graph-data-structure';
import { logger } from '../../logger';
import path from 'path';
import upath from 'upath';
import { regEx } from '../../util/regex';
import util from 'util';
import { readLocalFile } from '../../util/fs';
import { DOMParser as dom } from 'xmldom';
import xpath from 'xpath';

const globAsync = util.promisify(glob);

// Get all package files at any level of ancestry that depend on `packageFileName`
export async function getDependentPackageFiles(
  packageFileName: string
): Promise<[string]> {
  const { localDir } = GlobalConfig.get();
  const packageFiles = await getAllPackageFiles();
  const graph = Graph();

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
      upath.normalize(a.value)
    );
    const normalizedRelativeProjectReferences = projectReferences.map((r) =>
      normalizeRelativePath(f, r)
    );

    for (const ref of normalizedRelativeProjectReferences) {
      graph.addEdge(f, ref);
    }
  }

  logger.info(graph.serialize(), 'Dependency graph');

  return packageFiles;
}

function normalizeRelativePath(fromPackageFile, toPackageFile): string {
  const { localDir } = GlobalConfig.get();
  const fromFullPath = `${localDir}/${fromPackageFile}`;
  const toFullPath = path.resolve(path.dirname(fromFullPath), toPackageFile);
  const relativeToPackageFile = path.relative(localDir, toFullPath);

  return relativeToPackageFile;
}

// Get a list of package files in `localDir`
async function getAllPackageFiles() {
  const { localDir } = GlobalConfig.get();
  const possiblePackageFiles = await globAsync(`${localDir}/**/*proj`);
  const filteredPackageFiles = possiblePackageFiles.filter((f) =>
    regEx(/(?:cs|vb|fs)proj$/i).test(f)
  );
  const relativePackageFiles = filteredPackageFiles.map((f) =>
    f.substring(localDir.length + 1)
  );
  return relativePackageFiles;
}
