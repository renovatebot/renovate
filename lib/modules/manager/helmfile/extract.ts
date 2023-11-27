import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { Doc } from './schema';
import {
  kustomizationsKeysUsed,
  localChartHasKustomizationsYaml,
} from './utils';

const isValidChartName = (name: string | undefined): boolean =>
  !!name && !regEx(/[!@#$%^&*(),.?":{}/|<>A-Z]/).test(name);

function extractYaml(content: string): string {
  // regex remove go templated ({{ . }}) values
  return content
    .replace(regEx(/{{`.+?`}}/gs), '')
    .replace(regEx(/{{.+?}}/g), '');
}

function isLocalPath(possiblePath: string): boolean {
  return ['./', '../', '/'].some((localPrefix) =>
    possiblePath.startsWith(localPrefix),
  );
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): Promise<PackageFileContent | null> {
  const deps: PackageDependency[] = [];
  let docs: Doc[];
  const registryAliases: Record<string, string> = {};
  // Record kustomization usage for all deps, since updating artifacts is run on the helmfile.yaml as a whole.
  let needKustomize = false;
  try {
    docs = loadAll(extractYaml(content), null, { json: true }) as Doc[];
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse helmfile helmfile.yaml',
    );
    return null;
  }
  for (const doc of docs) {
    if (!(doc && is.array(doc.releases))) {
      continue;
    }

    if (doc.repositories) {
      for (let i = 0; i < doc.repositories.length; i += 1) {
        registryAliases[doc.repositories[i].name] = doc.repositories[i].url;
      }
    }
    logger.debug({ registryAliases }, 'repositories discovered.');

    for (const dep of doc.releases) {
      let depName = dep.chart;
      let repoName: string | null = null;

      if (!is.string(dep.chart)) {
        deps.push({
          depName: dep.name,
          skipReason: 'invalid-name',
        });
        continue;
      }

      // If it starts with ./ ../ or / then it's a local path
      if (isLocalPath(dep.chart)) {
        if (
          kustomizationsKeysUsed(dep) ||
          (await localChartHasKustomizationsYaml(dep, packageFile))
        ) {
          needKustomize = true;
        }
        deps.push({
          depName: dep.name,
          skipReason: 'local-chart',
        });
        continue;
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
        deps.push({
          depName,
          skipReason: 'invalid-version',
        });
        continue;
      }

      const res: PackageDependency = {
        depName,
        currentValue: dep.version,
        registryUrls: [registryAliases[repoName]]
          .concat([config.registryAliases?.[repoName]] as string[])
          .filter(is.string),
      };
      if (kustomizationsKeysUsed(dep)) {
        needKustomize = true;
      }
      // in case of OCI repository, we need a PackageDependency with a DockerDatasource and a packageName
      const repository = doc.repositories?.find(
        (repo) => repo.name === repoName,
      );
      if (repository?.oci) {
        res.datasource = DockerDatasource.id;
        res.packageName = registryAliases[repoName] + '/' + depName;
      }

      // By definition on helm the chart name should be lowercase letter + number + -
      // However helmfile support templating of that field
      if (!isValidChartName(res.depName)) {
        res.skipReason = 'unsupported-chart-type';
      }

      // Skip in case we cannot locate the registry
      if (is.emptyArray(res.registryUrls)) {
        res.skipReason = 'unknown-registry';
      }

      deps.push(res);
    }
  }

  return deps.length
    ? {
        deps,
        datasource: HelmDatasource.id,
        ...(needKustomize && { managerData: { needKustomize } }),
      }
    : null;
}
