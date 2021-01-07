import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import * as datasourceHelm from '../../datasource/helm';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { getSiblingFileName, readLocalFile } from '../../util/fs';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile> {
  try {
    const chartFileName = getSiblingFileName(fileName, 'Chart.yaml');
    const chartContents = await readLocalFile(chartFileName, 'utf8');
    if (!chartContents) {
      logger.debug({ fileName }, 'Failed to find helm Chart.yaml');
      return null;
    }
    // TODO: fix me
    const chart = yaml.safeLoad(chartContents, { json: true }) as any;
    if (!(chart?.apiVersion && chart.name && chart.version)) {
      logger.debug(
        { fileName },
        'Failed to find required fields in Chart.yaml'
      );
      return null;
    }
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
    return null;
  }
  let deps = [];
  let doc;
  try {
    doc = yaml.safeLoad(content, { json: true });
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm requirements.yaml');
    return null;
  }
  if (!(doc && is.array(doc.dependencies))) {
    logger.debug({ fileName }, 'requirements.yaml has no dependencies');
    return null;
  }
  deps = doc.dependencies.map((dep) => {
    const res: PackageDependency = {
      depName: dep.name,
      currentValue: dep.version,
    };

    if (!res.depName) {
      res.skipReason = SkipReason.InvalidName;
    }

    if (!res.currentValue) {
      res.skipReason = SkipReason.InvalidVersion;
    }

    if (!dep.repository) {
      res.skipReason = SkipReason.NoRepository;
    }

    if (res.skipReason) {
      return res;
    }

    res.registryUrls = [dep.repository];
    if (dep.repository.startsWith('@')) {
      const repoWithAtRemoved = dep.repository.slice(1);
      const alias = config.aliases[repoWithAtRemoved];
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
    return res;
  });
  const res = {
    deps,
    datasource: datasourceHelm.id,
  };
  return res;
}
