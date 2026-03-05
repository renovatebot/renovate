import { isArray, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { parseSingleYaml } from '../../../util/yaml.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { TravisMatrixItem, TravisYaml } from './types.ts';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  let doc: TravisYaml;
  try {
    // TODO: use schema (#9610)
    doc = parseSingleYaml(content);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse .travis.yml file.');
    return null;
  }
  let deps: PackageDependency[] = [];
  if (doc && isArray(doc.node_js)) {
    deps = doc.node_js.map((currentValue) => ({
      depName: 'node',
      datasource: NodeVersionDatasource.id,
      currentValue: currentValue.toString(),
    }));
  }

  // Handle the matrix syntax
  let matrix_include: TravisMatrixItem[] | undefined;
  if (doc?.jobs?.include) {
    matrix_include = doc.jobs.include;
  } else if (doc?.matrix?.include) {
    matrix_include = doc.matrix.include;
  }

  if (!isArray(matrix_include)) {
    return deps.length ? { deps } : null;
  }

  for (const item of matrix_include) {
    if (item?.node_js) {
      if (isArray(item.node_js)) {
        item.node_js.forEach((currentValue) => {
          deps.push({
            depName: 'node',
            datasource: NodeVersionDatasource.id,
            currentValue: currentValue.toString(),
          });
        });
      } else if (isString(item.node_js)) {
        deps.push({
          depName: 'node',
          datasource: NodeVersionDatasource.id,
          currentValue: item.node_js.toString(),
        });
      }
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
