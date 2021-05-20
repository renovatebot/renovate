import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import * as datasourceHelm from '../../datasource/helm';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile {
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
      return res;
    }

    if (!res.currentValue) {
      res.skipReason = SkipReason.InvalidVersion;
      return res;
    }

    if (!dep.repository) {
      res.skipReason = SkipReason.NoRepository;
      return res;
    }

    res.registryUrls = [dep.repository];
    if (dep.repository.startsWith('@') || dep.repository.startsWith('alias:')) {
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
    return res;
  });
  const res = {
    deps,
    datasource: datasourceHelm.id,
  };
  return res;
}
