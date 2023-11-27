import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { id as dockerVersioning } from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';
import type { HelmDockerImageDependency } from './types';
import {
  matchesHelmValuesDockerHeuristic,
  matchesHelmValuesInlineImage,
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
  packageDependencies: Array<PackageDependency>,
): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return packageDependencies;
  }

  Object.entries(parsedContent).forEach(([key, value]) => {
    if (matchesHelmValuesDockerHeuristic(key, value)) {
      const currentItem = value;

      let registry = currentItem.registry;
      registry = registry ? `${registry}/` : '';
      const repository = String(currentItem.repository);
      const tag = `${currentItem.tag ?? currentItem.version}`;
      packageDependencies.push(getHelmDep({ repository, tag, registry }));
    } else if (matchesHelmValuesInlineImage(key, value)) {
      packageDependencies.push(getDep(value));
    } else {
      findDependencies(value as Record<string, unknown>, packageDependencies);
    }
  });
  return packageDependencies;
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  let parsedContent: Record<string, unknown>[] | HelmDockerImageDependency[];
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me (#9610)
    parsedContent = loadAll(content, null, { json: true }) as any;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const con of parsedContent) {
      deps.push(...findDependencies(con, []));
    }

    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { err, packageFile },
      'Error parsing helm-values parsed content',
    );
  }
  return null;
}
