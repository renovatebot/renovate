import { isNonEmptyObject, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { withDebugMessage } from '../../../util/schema-utils/index.ts';
import { trimTrailingSlash } from '../../../util/url.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import {
  getOciChartDep,
  isOCIRegistry,
  removeOCIPrefix,
} from '../helmv3/oci.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import {
  type ApplicationDefinition,
  ApplicationDefinitions,
  type ApplicationSource,
  type ApplicationSpec,
} from './schema.ts';
import { fileTestRegex } from './util.ts';

const kustomizeImageRe = regEx(/=(?<image>.+)$/);

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  // check for argo reference. API version for the kind attribute is used
  if (!fileTestRegex.test(content)) {
    logger.debug(
      `Skip file ${packageFile} as no argoproj.io apiVersion could be found in matched file`,
    );
    return null;
  }

  const definitions = ApplicationDefinitions.catch(
    withDebugMessage([], `${packageFile} does not match schema`),
  ).parse(content);

  const deps = definitions.flatMap((definition) =>
    processAppSpec(definition, config?.registryAliases),
  );

  return deps.length ? { deps } : null;
}

function processSource(
  source: ApplicationSource,
  registryAliases: Record<string, string> | undefined,
): PackageDependency[] {
  // a chart variable is defined this is helm declaration
  if (source.chart) {
    // assume OCI helm chart if repoURL doesn't contain explicit protocol
    if (isOCIRegistry(source.repoURL) || !source.repoURL.includes('://')) {
      const registryURL = trimTrailingSlash(removeOCIPrefix(source.repoURL));
      const depName =
        registryURL === source.chart || registryURL.endsWith(`/${source.chart}`)
          ? registryURL
          : `${registryURL}/${source.chart}`;

      return [
        {
          ...getOciChartDep(depName, undefined, registryAliases),
          depName,
          currentValue: source.targetRevision,
        },
      ];
    }

    return [
      {
        depName: source.chart,
        registryUrls: [source.repoURL],
        currentValue: source.targetRevision,
        datasource: HelmDatasource.id,
      },
    ];
  }

  // Handle OCI Helm chart without an explicit chart field
  if (isOCIRegistry(source.repoURL)) {
    let registryURL = trimTrailingSlash(removeOCIPrefix(source.repoURL));

    // Some users repeat the chart name at the end of the repoURL, following
    // the `helm pull oci://.../<chart>` convention. It is not part of the OCI
    // image, so strip it before building the dependency.
    const parts = registryURL.split('/');
    const lastPart = parts.at(-1);
    if (parts.length > 1 && lastPart === parts.at(-2)) {
      const dedupedURL = parts.slice(0, -1).join('/');
      logger.warn(
        {
          repoURL: source.repoURL,
          chartName: lastPart,
          dedupedURL,
        },
        'ArgoCD OCI repoURL repeats the chart name at the end; using the deduplicated chart reference',
      );
      registryURL = dedupedURL;
    }

    return [
      {
        ...getOciChartDep(registryURL, undefined, registryAliases),
        depName: registryURL,
        currentValue: source.targetRevision,
      },
    ];
  }

  const dependencies: PackageDependency[] = [
    {
      depName: source.repoURL,
      currentValue: source.targetRevision,
      datasource: GitTagsDatasource.id,
    },
  ];

  // Git repo is pointing to a Kustomize resource
  if (source.kustomize?.images) {
    dependencies.push(
      ...source.kustomize.images.map(processKustomizeImage).filter(isTruthy),
    );
  }

  return dependencies;
}

function processAppSpec(
  definition: ApplicationDefinition,
  registryAliases: Record<string, string> | undefined,
): PackageDependency[] {
  const spec: ApplicationSpec =
    definition.kind === 'Application'
      ? definition.spec
      : definition.spec.template.spec;

  const deps: PackageDependency[] = [];

  if (isNonEmptyObject(spec.source)) {
    deps.push(...processSource(spec.source, registryAliases));
  }

  for (const source of coerceArray(spec.sources)) {
    deps.push(...processSource(source, registryAliases));
  }

  return deps;
}

function processKustomizeImage(
  kustomizeImage: string,
): PackageDependency | null {
  const parts = kustomizeImageRe.exec(kustomizeImage);
  if (!parts?.groups?.image) {
    return null;
  }

  return getDep(parts.groups.image);
}
