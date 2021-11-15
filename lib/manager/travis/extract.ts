import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  // TODO: fix type
  let doc: any;
  try {
    doc = load(content, { json: true });
  } catch (err) {
    logger.warn({ err, content }, 'Failed to parse .travis.yml file.');
    return null;
  }
  let deps: PackageDependency[] = [];
  if (doc && is.array(doc.node_js)) {
    deps = doc.node_js.map((currentValue) => ({
      depName: 'node',
      datasource: datasourceGithubTags.id,
      lookupName: 'nodejs/node',
      currentValue: currentValue.toString(),
    }));
  }

  // Handle the matrix syntax
  let matrix_include: any;
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (doc && doc?.jobs?.include) {
    matrix_include = doc?.jobs?.include;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  } else if (doc && doc?.matrix?.include) {
    matrix_include = doc.matrix.include;
  }

  if (is.array(matrix_include)) {
    matrix_include
      .filter((item: any) => item?.node_js)
      .forEach((item: any) => {
        if (is.array(item.node_js)) {
          item.node_js.forEach((currentValue) => {
            deps.push({
              depName: 'node',
              datasource: datasourceGithubTags.id,
              lookupName: 'nodejs/node',
              currentValue: currentValue.toString(),
            });
          });
        } else if (is.string(item.node_js)) {
          deps.push({
            depName: 'node',
            datasource: datasourceGithubTags.id,
            lookupName: 'nodejs/node',
            currentValue: item.node_js.toString(),
          });
        }
      });
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
