import { isNonEmptyObject, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { withDebugMessage } from '../../../util/schema-utils/index.ts';
import { trimTrailingSlash } from '../../../util/url.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci.ts';
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
  _config?: ExtractConfig,
): PackageFileContent | null {
  // check for argo reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    logger.debug(
      `Skip file ${packageFile} as no argoproj.io apiVersion could be found in matched file`,
    );
    return null;
  }

  const definitions = ApplicationDefinitions.catch(
    withDebugMessage([], `${packageFile} does not match schema`),
  ).parse(content);

  const deps = definitions.flatMap(processAppSpec);

  return deps.length ? { deps } : null;
}

function processSource(source: ApplicationSource): PackageDependency[] {
  // a chart variable is defined this is helm declaration
  if (source.chart) {
    // assume OCI helm chart if repoURL doesn't contain explicit protocol
    if (isOCIRegistry(source.repoURL) || !source.repoURL.includes('://')) {
      const registryURL = trimTrailingSlash(removeOCIPrefix(source.repoURL));

      return [
        {
          depName: `${registryURL}/${source.chart}`,
          currentValue: source.targetRevision,
          datasource: DockerDatasource.id,
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

  // Handle OCI Helm chart without explicit chart field
  if (isOCIRegistry(source.repoURL)) {
    const registryURL = trimTrailingSlash(removeOCIPrefix(source.repoURL));

    return [
      {
        depName: registryURL,
        currentValue: source.targetRevision,
        datasource: DockerDatasource.id,
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

  // Git repo is pointing to a Kustomize resources
  if (source.kustomize?.images) {
    dependencies.push(
      ...source.kustomize.images.map(processKustomizeImage).filter(isTruthy),
    );
  }

  return dependencies;
}

function processAppSpec(
  definition: ApplicationDefinition,
): PackageDependency[] {
  const spec: ApplicationSpec =
    definition.kind === 'Application'
      ? definition.spec
      : definition.spec.template.spec;

  const deps: PackageDependency[] = [];

  if (isNonEmptyObject(spec.source)) {
    deps.push(...processSource(spec.source));
  }

  for (const source of coerceArray(spec.sources)) {
    deps.push(...processSource(source));
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
