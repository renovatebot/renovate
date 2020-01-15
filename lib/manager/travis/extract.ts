import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import {
  PackageFile,
  PackageDependency,
  ExtractPackageFileConfig,
} from '../common';
import { logger } from '../../logger';

export function extractPackageFile({
  fileContent,
}: ExtractPackageFileConfig): PackageFile | null {
  let doc;
  try {
    doc = yaml.safeLoad(fileContent, { json: true });
  } catch (err) {
    logger.warn({ err, fileContent }, 'Failed to parse .travis.yml file.');
    return null;
  }
  let deps: PackageDependency[] = [];
  if (doc && is.array(doc.node_js)) {
    deps = [
      {
        depName: 'node',
        currentValue: doc.node_js,
      },
    ];
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
