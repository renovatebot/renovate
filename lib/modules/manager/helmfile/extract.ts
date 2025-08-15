import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { parseYaml } from '../../../util/yaml';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
import { isOCIRegistry } from '../helmv3/oci';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { Doc, HelmRepository } from './schema';
import { Doc as Document } from './schema';
import {
  kustomizationsKeysUsed,
  localChartHasKustomizationsYaml,
} from './utils';

function isValidChartName(name: string | undefined, oci: boolean): boolean {
  if (oci) {
    return !!name && !regEx(/[!@#$%^&*(),.?":{}|<>A-Z]/).test(name);
  } else {
    return !!name && !regEx(/[!@#$%^&*(),.?":{}/|<>A-Z]/).test(name);
  }
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
  let registryData: Record<string, HelmRepository> = {};
  // Record kustomization usage for all deps, since updating artifacts is run on the helmfile.yaml as a whole.
  let needKustomize = false;
  const docs: Doc[] = parseYaml(content, {
    customSchema: Document,
    failureBehaviour: 'filter',
    removeTemplates: true,
  });

  for (const doc of docs) {
    // Always check for repositories in the current document and override the existing ones if any (as YAML does)
    if (doc.repositories) {
      registryData = {};
      for (const repo of doc.repositories) {
        if (repo.url?.startsWith('git+')) {
          logger.debug(
            { repo, packageFile },
            `Skipping unsupported helm-git repository.`,
          );
          continue;
        }
        registryData[repo.name] = repo;
      }
      logger.debug(
        { registryAliases: registryData, packageFile },
        `repositories discovered.`,
      );
    }

    for (const dep of coerceArray(doc.releases)) {
      let depName = dep.chart;
      let repoName: string | null = null;

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

      // For non-OCI charts, split "repo/chart"
      if (!isOCIRegistry(dep.chart)) {
        const firstSlash = dep.chart.indexOf('/');
        if (firstSlash > 0) {
          repoName = dep.chart.slice(0, firstSlash);
          depName = dep.chart.slice(firstSlash + 1);
        }
      }

      if (!is.string(dep.version)) {
        deps.push({
          depName,
          skipReason: 'invalid-version',
        });
        continue;
      }

      const registryUrl = repoName ? registryData[repoName]?.url : undefined;
      const aliasUrl = repoName
        ? config.registryAliases?.[repoName]
        : undefined;

      const res: PackageDependency = {
        depName,
        currentValue: dep.version,
        registryUrls: [registryUrl, aliasUrl].filter(is.string),
      };

      if (kustomizationsKeysUsed(dep)) {
        needKustomize = true;
      }

      if (isOCIRegistry(dep.chart)) {
        const ociRef = dep.chart.replace(/^oci:\/\//, '');
        res.datasource = DockerDatasource.id;
        res.packageName = ociRef;
        res.depName = ociRef;
        if (res.registryUrls?.length) {
          delete res.registryUrls;
        }
      } else if (repoName && registryData[repoName]?.oci) {
        const base =
          registryData[repoName]?.url ?? config.registryAliases?.[repoName];
        if (base) {
          const withoutPrefix = isOCIRegistry(base)
            ? base.replace(/^oci:\/\//, '')
            : base;
          res.datasource = DockerDatasource.id;
          res.packageName = `${withoutPrefix}/${depName}`;
          res.depName = res.packageName;
          if (res.registryUrls?.length) {
            delete res.registryUrls;
          }
        }
      }

      // By definition on helm the chart name should be lowercase letter + number + -
      // However helmfile support templating of that field
      const isOci =
        isOCIRegistry(dep.chart) ||
        (repoName ? !!registryData[repoName]?.oci : false);
      if (!isValidChartName(res.depName, isOci)) {
        res.skipReason = 'unsupported-chart-type';
      }

      // Skip in case we cannot locate the registry
      if (
        res.datasource !== DockerDatasource.id &&
        is.emptyArray(res.registryUrls)
      ) {
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
