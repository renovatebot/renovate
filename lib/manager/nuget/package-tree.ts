import glob from 'glob';
import { GlobalConfig } from '../../config/global';
import Graph from 'graph-data-structure';
import { logger } from '../../logger';
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

  for (const f in packageFiles) {
    graph.addNode(f);
  }

  for (const f of packageFiles) {
    logger.info(`Reading local file ${f}`);
    const packageFileContent = (await readLocalFile(f, 'utf8')).toString();

    const doc = new dom().parseFromString(packageFileContent);
    const projectReferenceAttributes = xpath.select(
      '//ProjectReference/@Include',
      doc
    );
    const projectReferences = projectReferenceAttributes.map((a) => a.value);

    logger.info(projectReferences, `Project references in ${f}`);
  }

  return packageFiles;
}

// Get a list of package files in `localDir`
async function getAllPackageFiles() {
  const { localDir } = GlobalConfig.get();
  const possiblePackageFiles = await globAsync(`${localDir}/**/*proj`);
  logger.info(possiblePackageFiles, 'Package files in repo');
  const filteredPackageFiles = possiblePackageFiles.filter((f) =>
    regEx(/(?:cs|vb|fs)proj$/i).test(f)
  );
  logger.info(filteredPackageFiles, 'Package files in repo');
  const relativePackageFiles = filteredPackageFiles.map((f) =>
    f.substring(localDir.length + 1)
  );
  logger.info(relativePackageFiles, 'Package files in repo');
  return relativePackageFiles;
}
