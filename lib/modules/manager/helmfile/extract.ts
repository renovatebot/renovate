import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { Doc } from './types';

const isValidChartName = (name: string | undefined): boolean =>
  !!name && !regEx(/[!@#$%^&*(),.?":{}/|<>A-Z]/).test(name);

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile | null {
  let deps: PackageDependency[] = [];
  let docs: Doc[];
  const aliases: Record<string, string> = {};
  try {
    docs = loadAll(content.replace(/(^|:)\s*{{.+}}\s*$/gm, '$1'), null, {
      json: true,
    }) as Doc[];
  } catch (err) {
    logger.debug({ err, fileName }, 'Failed to parse helmfile helmfile.yaml');
    return null;
  }
  for (const doc of docs) {
    if (!(doc && is.array(doc.releases))) {
      continue;
    }

    if (doc.repositories) {
      for (let i = 0; i < doc.repositories.length; i += 1) {
        aliases[doc.repositories[i].name] = doc.repositories[i].url;
      }
    }
    logger.debug({ aliases }, 'repositories discovered.');

    deps = doc.releases.map((dep) => {
      let depName = dep.chart;
      let repoName: string | null = null;

      if (!is.string(dep.chart)) {
        return {
          depName: dep.name,
          skipReason: 'invalid-name',
        };
      }

      // If starts with ./ is for sure a local path
      if (dep.chart.startsWith('./')) {
        return {
          depName: dep.name,
          skipReason: 'local-chart',
        };
      }

      if (is.number(dep.version)) {
        dep.version = String(dep.version);
      }

      if (dep.chart.includes('/')) {
        const v = dep.chart.split('/');
        repoName = v.shift()!;
        depName = v.join('/');
      } else {
        repoName = dep.chart;
      }

      if (!is.string(dep.version)) {
        return {
          depName,
          skipReason: 'invalid-version',
        };
      }

      const res: PackageDependency = {
        depName,
        currentValue: dep.version,
        registryUrls: [aliases[repoName]]
          .concat([config.aliases?.[repoName]] as string[])
          .filter(is.string),
      };

      // By definition on helm the chart name should be lowercase letter + number + -
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
  }

  return deps.length ? { deps, datasource: HelmDatasource.id } : null;
}
