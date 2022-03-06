import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { parseRepository, resolveAlias } from './utils';

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  let chart: {
    apiVersion: string;
    name: string;
    version: string;
    dependencies: Array<{ name: string; version: string; repository: string }>;
  };
  try {
    // TODO: fix me (#9610)
    chart = load(content, { json: true }) as any;
    if (!(chart?.apiVersion && chart.name && chart.version)) {
      logger.debug(
        { fileName },
        'Failed to find required fields in Chart.yaml'
      );
      return null;
    }
    if (chart.apiVersion !== 'v2') {
      logger.debug(
        { fileName },
        'Unsupported Chart apiVersion. Only v2 is supported.'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
    return null;
  }
  const packageFileVersion = chart.version;
  let deps: PackageDependency[] = [];
  if (!is.nonEmptyArray(chart?.dependencies)) {
    logger.debug({ fileName }, 'Chart has no dependencies');
    return null;
  }
  const validDependencies = chart.dependencies.filter(
    (dep) => is.nonEmptyString(dep.name) && is.nonEmptyString(dep.version)
  );
  if (!is.nonEmptyArray(validDependencies)) {
    logger.debug('Name and/or version missing for all dependencies');
    return null;
  }
  deps = validDependencies.map((dep) => {
    const res: PackageDependency = {
      depName: dep.name,
      currentValue: dep.version,
    };
    if (!dep.repository) {
      res.skipReason = 'no-repository';
      return res;
    }

    const repository = resolveAlias(dep.repository, config.aliases);
    if (!repository) {
      res.skipReason = 'placeholder-url';
      return res;
    }

    const result: PackageDependency = {
      ...res,
      ...parseRepository(dep.name, repository),
    };
    return result;
  });
  const res: PackageFile = {
    deps,
    datasource: HelmDatasource.id,
    packageFileVersion,
  };
  const lockFileName = getSiblingFileName(fileName, 'Chart.lock');
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
