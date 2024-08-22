import { logger } from '../../../logger';
import { parseYaml } from '../../../util/yaml';
import { id as dockerVersioning } from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { HelmDockerImageDependency } from './types';
import {
  matchesHelmValuesDockerHeuristic,
  matchesHelmValuesInlineImage,
} from './util';

function getHelmDep(
  registry: string,
  repository: string,
  tag: string,
  config: ExtractConfig,
): PackageDependency {
  const dep = getDep(
    `${registry}${repository}:${tag}`,
    false,
    config.registryAliases,
  );
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
  config: ExtractConfig,
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
      packageDependencies.push(getHelmDep(registry, repository, tag, config));
    } else if (matchesHelmValuesInlineImage(key, value)) {
      packageDependencies.push(getDep(value, true, config.registryAliases));
    } else {
      findDependencies(
        value as Record<string, unknown>,
        packageDependencies,
        config,
      );
    }
  });
  return packageDependencies;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  let parsedContent: Record<string, unknown>[] | HelmDockerImageDependency[];
  try {
    // a parser that allows extracting line numbers would be preferable, with
    // the current approach we need to match anything we find again during the update
    // TODO: fix me (#9610)
    parsedContent = parseYaml(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse helm-values YAML');
    return null;
  }
  try {
    const deps: PackageDependency<Record<string, any>>[] = [];

    for (const con of parsedContent) {
      deps.push(...findDependencies(con, [], config));
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
