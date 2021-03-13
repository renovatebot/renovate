import yaml from 'js-yaml';
import { logger } from '../../logger';
import { id as dockerVersioning } from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

import {
  HelmDockerImageDependency,
  matchesHelmValuesDockerHeuristic,
} from './util';

function getHelmDep({
  registry,
  repository,
  tag,
}: {
  registry: string;
  repository: string;
  tag: string;
}): PackageDependency {
  const dep = getDep(`${registry}${repository}:${tag}`, false);
  dep.replaceString = tag;
  dep.versioning = dockerVersioning;
  dep.autoReplaceStringTemplate =
    '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}';
  return dep;
}

/**
 * Recursively find all supported dependencies in the yaml object.
 *
 * @param parsedContent
 */
function findDependencies(
  parsedContent: Record<string, unknown> | HelmDockerImageDependency,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  Object.keys(parsedContent).forEach((key) => {
    if (matchesHelmValuesDockerHeuristic(key, parsedContent[key])) {
      const currentItem = parsedContent[key];

      let registry: string = currentItem.registry;
      registry = registry ? `${registry}/` : '';
      const repository = String(currentItem.repository);
      const tag = String(currentItem.tag);
      packageDependencies.push(getHelmDep({ repository, tag, registry }));
    } else {
      findDependencies(parsedContent[key], packageDependencies);
    }
  });
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  let parsedContent: Record<string, unknown> | HelmDockerImageDependency;
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me
    parsedContent = yaml.safeLoad(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent, []);
    if (deps.length) {
      logger.debug({ deps }, 'Found dependencies in helm-values');
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error parsing helm-values parsed content');
  }
  return null;
}
