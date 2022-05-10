import { logger } from '../../../logger';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency } from '../types';
import type { ChartDefinition, Repository } from './types';

export function parseRepository(
  depName: string,
  repositoryURL: string
): PackageDependency {
  const res: PackageDependency = {};

  try {
    const url = new URL(repositoryURL);
    switch (url.protocol) {
      case 'oci:':
        res.datasource = DockerDatasource.id;
        res.packageName = `${repositoryURL.replace('oci://', '')}/${depName}`;
        break;
      case 'file:':
        res.skipReason = 'local-dependency';
        break;
      default:
        res.registryUrls = [repositoryURL];
    }
  } catch (err) {
    logger.debug({ err }, 'Error parsing url');
    res.skipReason = 'invalid-url';
  }
  return res;
}

/**
 * Resolves alias in repository string.
 *
 * @param repository to be resolved string
 * @param aliases Records containing aliases as key and to be resolved URLs as values
 *
 * @returns  resolved alias. If repository does not contain an alias the repository string will be returned. Should it contain an alias which can not be resolved using `aliases`, null will be returned
 */
export function resolveAlias(
  repository: string,
  aliases: Record<string, string>
): string | null {
  if (!isAlias(repository)) {
    return repository;
  }

  const repoWithPrefixRemoved = repository.slice(repository[0] === '@' ? 1 : 6);
  const alias = aliases[repoWithPrefixRemoved];
  if (alias) {
    return alias;
  }
  return null;
}

export function getRepositories(definitions: ChartDefinition[]): Repository[] {
  const repositoryList = definitions
    .flatMap((value) => value.dependencies)
    .filter((dependency) => dependency.repository) // only keep non-local references --> if no repository is defined the chart will be searched in charts/<name>
    .filter((dependency) => !isAlias(dependency.repository)) // do not add aliases
    .filter((dependency) => !dependency.repository.startsWith('file:')) // skip repositories which are locally referenced
    .map((dependency) => {
      // remove additional keys to prevent interference at deduplication
      return {
        name: dependency.name,
        repository: dependency.repository,
      };
    });
  const dedup = new Set();
  return repositoryList.filter((el) => {
    const duplicate = dedup.has(el.repository);
    dedup.add(el.repository);
    return !duplicate;
  });
}

export function isAlias(repository: string): boolean {
  if (!repository) {
    return false;
  }
  return repository.startsWith('@') || repository.startsWith('alias:');
}

export function isOCIRegistry(repository: Repository): boolean {
  return repository.repository.startsWith('oci://');
}

export function aliasRecordToRepositories(
  aliases: Record<string, string>
): Repository[] {
  return Object.entries(aliases).map(([alias, url]) => {
    return {
      name: alias,
      repository: url,
    };
  });
}
