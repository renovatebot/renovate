import is from '@sindresorhus/is';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile, PackageDependency, ExtractConfig } from '../common';

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile {
  let deps = [];
  let doc;
  const aliases: Record<string, string> = {};
  try {
    doc = yaml.safeLoad(content, { json: true });
  } catch (err) {
    logger.debug({ err, fileName }, 'Failed to parse helmfile helmfile.yaml');
    return null;
  }
  if (!(doc && is.array(doc.releases))) {
    logger.debug({ fileName }, 'helmfile.yaml has no releases');
    return null;
  }

  if (doc.repositories) {
    for (let i = 0; i < doc.repositories.length; i += 1) {
      aliases[doc.repositories[i].name] = doc.repositories[i].url;
    }
  }
  logger.debug({ aliases }, 'repositories discovered.');

  deps = doc.releases.map(dep => {
    let depName = dep.chart;
    let repoName = null;

    if (dep.chart.startsWith('./')) {
      return {
        depName,
        skipReason: 'local-chart',
      } as PackageDependency;
    }

    if (dep.chart.includes('/')) {
      const v = dep.chart.split('/');
      depName = v[1];
      repoName = v[0];
    } else {
      repoName = dep.chart;
    }

    const res: PackageDependency = {
      depName,
      currentValue: dep.version,
      registryUrls: [aliases[repoName]]
        .concat([config.aliases[repoName]])
        .filter((v, _) => {
          return v != null;
        }),
    };

    if (res.depName.includes('{') || res.depName.includes('}')) {
      res.skipReason = 'invalid-chart';
    }

    if (is.emptyArray(res.registryUrls)) {
      res.skipReason = 'invalid-registry';
    }

    return res;
  });
  const res = {
    deps,
    datasource: 'helm',
  };
  return res;
}
