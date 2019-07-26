import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { PackageFile, PackageDependency } from '../common';
import { logger } from '../../logger';

export function extractPackageFile(content: string): PackageFile {
  let doc;
  try {
    doc = yaml.safeLoad(content);
  } catch (err) {
    logger.warn({ err, content }, 'Failed to parse .travis.yml file.');
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
