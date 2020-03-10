import is from '@sindresorhus/is';
import upath from 'upath';
import yaml from 'js-yaml';
import { SkipReason } from '../../types';
import { logger } from '../../logger';
import { PackageFile, PackageDependency, ExtractConfig } from '../common';
import { platform } from '../../platform';
import * as datasourceHelm from '../../datasource/helm';

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile> {
  try {
    const baseDir = upath.parse(fileName).dir;
    const chartFileName = upath.join(baseDir, 'Chart.yaml');
    const chartContents = await platform.getFile(chartFileName);
    if (!chartContents) {
      logger.debug({ fileName }, 'Failed to find helm Chart.yaml');
      return null;
    }
    const chart = yaml.safeLoad(chartContents, { json: true });
    if (!(chart && chart.apiVersion && chart.name && chart.version)) {
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
  deps = doc.dependencies.map(dep => {
    const res: PackageDependency = {
      depName: dep.name,
      currentValue: dep.version,
    };
    if (dep.repository) {
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
    } else {
      res.skipReason = SkipReason.NoRepository;
    }
    return res;
  });
  const res = {
    deps,
    datasource: datasourceHelm.id,
  };
  return res;
}
