import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import * as datasourceHelm from '../../datasource/helm';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { getSiblingFileName, localPathExists } from '../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

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
    // TODO: fix me
    chart = yaml.safeLoad(content, { json: true }) as any;
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
    if (dep.repository) {
      res.registryUrls = [dep.repository];
      if (
        dep.repository.startsWith('@') ||
        dep.repository.startsWith('alias:')
      ) {
        const repoWithPrefixRemoved = dep.repository.slice(
          dep.repository[0] === '@' ? 1 : 6
        );
        const alias = config.aliases[repoWithPrefixRemoved];
        if (alias) {
          res.registryUrls = [alias];
          return res;
        }

        res.skipReason = SkipReason.PlaceholderUrl;
      } else {
        try {
          const url = new URL(dep.repository);
          if (url.protocol === 'file:') {
            res.skipReason = SkipReason.LocalDependency;
          }
        } catch (err) {
          logger.debug({ err }, 'Error parsing url');
          res.skipReason = SkipReason.InvalidUrl;
        }
      }
    } else {
      res.skipReason = SkipReason.NoRepository;
    }
    return res;
  });
  const res: PackageFile = {
    deps,
    datasource: datasourceHelm.id,
    packageFileVersion,
  };
  const lockFileName = getSiblingFileName(fileName, 'Chart.lock');
  // istanbul ignore if
  if (await localPathExists(lockFileName)) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
