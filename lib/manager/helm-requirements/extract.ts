import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { HelmDatasource } from '../../datasource/helm';
import { logger } from '../../logger';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile {
  let deps = [];
  // TODO: fix type
  let doc: any;
  try {
    doc = load(content, { json: true }); // TODO #9610
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm requirements.yaml');
    return null;
  }
  if (!(doc && is.array(doc.dependencies))) {
    logger.debug({ fileName }, 'requirements.yaml has no dependencies');
    return null;
  }
  deps = doc.dependencies.map((dep) => {
    let currentValue; // Remove when #9610 has been implemented
    switch (typeof dep.version) {
      case 'number':
        currentValue = String(dep.version);
        break;
      case 'string':
        currentValue = dep.version;
    }

    const res: PackageDependency = {
      depName: dep.name,
      currentValue,
    };

    if (!res.depName) {
      res.skipReason = 'invalid-name';
      return res;
    }

    if (!res.currentValue) {
      res.skipReason = 'invalid-version';
      return res;
    }

    if (!dep.repository) {
      res.skipReason = 'no-repository';
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

      res.skipReason = 'placeholder-url';
    } else {
      try {
        const url = new URL(dep.repository);
        if (url.protocol === 'file:') {
          res.skipReason = 'local-dependency';
        }
      } catch (err) {
        logger.debug({ err }, 'Error parsing url');
        res.skipReason = 'invalid-url';
      }
    }
    return res;
  });
  const res = {
    deps,
    datasource: HelmDatasource.id,
  };
  return res;
}
