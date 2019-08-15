import is from '@sindresorhus/is';
import upath from 'upath';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile> {
  try {
    const baseDir = upath.parse(fileName).dir;
    const chartFileName = upath.join(baseDir, 'Chart.yaml');
    const chart = await platform.getFile(chartFileName);
    if (!chart) {
      logger.warn('Failed to read Chart.yaml');
    }
  } catch (err) {
    logger.warn('Failed to parse Chart.yaml');
  }
  logger.trace('helm.extractPackageFile()');
  let deps = [];
  try {
    const doc = yaml.safeLoad(content);
    if (doc && is.array(doc.dependencies)) {
      deps = doc.dependencies.map(dep => {
        const res: PackageDependency = {
          depName: dep.name,
          currentValue: dep.version,
          registryUrls: [dep.repository],
        };
        const url = new URL(dep.repository);
        if (url.protocol === 'file:') {
          res.skipReason = 'local-dependency';
        }
        return res;
      });
    }
  } catch (err) {
    logger.warn(
      { err, fileName },
      'extractPackageFile failed to parse requirements.yaml file'
    );
  }
  if (deps.length === 0) {
    logger.debug(
      { fileName },
      "extractPackageFile didn't extract any dependencies"
    );
    return null;
  }
  const res = {
    deps,
    datasource: 'helm',
  };
  return res;
}
