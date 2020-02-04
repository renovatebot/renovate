import is from '@sindresorhus/is';
import yaml from 'js-yaml';

import { logger } from '../../logger';
import { PackageFile, PackageDependency, ExtractConfig } from '../common';

const isValidChartName = (name: string): boolean => {
  return name.match(/[!@#$%^&*(),.?":{}/|<>A-Z]/) === null;
};

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

    // If starts with ./ is for sure a local path
    if (dep.chart.startsWith('./')) {
      return {
        depName,
        skipReason: 'local-chart',
      } as PackageDependency;
    }

    if (dep.chart.includes('/')) {
      const v = dep.chart.split('/');
      repoName = v.shift();
      depName = v.join('/');
    } else {
      repoName = dep.chart;
    }

    const res: PackageDependency = {
      depName,
      currentValue: dep.version,
      registryUrls: [aliases[repoName]]
        .concat([config.aliases[repoName]])
        .filter(Boolean),
    };

    // If version is null is probably a local chart
    if (!res.currentValue) {
      res.skipReason = 'local-chart';
    }

    // By definition on helm the chart name should be lowecase letter + number + -
    // However helmfile support templating of that field
    if (!isValidChartName(res.depName)) {
      res.skipReason = 'unsupported-chart-type';
    }

    // Skip in case we cannot locate the registry
    if (is.emptyArray(res.registryUrls)) {
      res.skipReason = 'unknown-registry';
    }

    return res;
  });

  return { deps, datasource: 'helm' } as PackageFile;
}
