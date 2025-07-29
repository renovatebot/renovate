import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { regEx } from '../../../util/regex';
import { withDebugMessage } from '../../../util/schema-utils';
import { trimTrailingSlash } from '../../../util/url';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import {
  type ApplicationDefinition,
  ApplicationDefinitionSchema,
  type ApplicationSource,
  type ApplicationSpec,
} from './schema';
import { fileTestRegex } from './util';

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

  const definitions = ApplicationDefinitionSchema.catch(
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
      ...source.kustomize.images.map(processKustomizeImage).filter(is.truthy),
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

  if (is.nonEmptyObject(spec.source)) {
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
