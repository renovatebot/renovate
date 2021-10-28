import { load } from 'js-yaml';
import { logger } from '../../logger';
import { id as dockerVersioning } from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { ConcourseDockerImageDependency } from './types';
import {
  matchesConcoursePipelineDockerHeuristic,
  matchesConcoursePipelineInlineImage,
} from './util';

function getConcourseDep({
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
  parsedContent: Record<string, unknown> | ConcourseDockerImageDependency,
  packageDependencies: Array<PackageDependency>
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  // TODO: Update to only look at resource_types rather than recursive walk
  // Also, parentKey based logic needs to change to be based on type or whathaveyou
  Object.keys(parsedContent).forEach((key) => {
    if (matchesConcoursePipelineDockerHeuristic(key, parsedContent[key])) {
      const currentItem = parsedContent[key];

      let registry: string = currentItem.registry;
      registry = registry ? `${registry}/` : '';
      const repository = String(currentItem.repository);
      const tag = String(currentItem.tag);
      packageDependencies.push(getConcourseDep({ repository, tag, registry }));
    } else if (matchesConcoursePipelineInlineImage(key, parsedContent[key])) {
      const currentItem = parsedContent[key];
      packageDependencies.push(getDep(currentItem));
    } else {
      findDependencies(parsedContent[key], packageDependencies);
    }
  });
  return packageDependencies;
}

export function extractPackageFile(content: string): PackageFile {
  let parsedContent: Record<string, unknown> | ConcourseDockerImageDependency;
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me (#9610)
    parsedContent = load(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent, []);
    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error parsing helm-values parsed content');
  }
  return null;
}
