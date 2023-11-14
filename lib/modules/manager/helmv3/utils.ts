import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency } from '../types';
import type { ChartDefinition, Repository } from './types';

export function parseRepository(
  depName: string,
  repositoryURL: string,
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
 * @param registryAliases Records containing registryAliases as key and to be resolved URLs as values
 *
 * @returns  resolved alias. If repository does not contain an alias the repository string will be returned. Should it contain an alias which can not be resolved using `registryAliases`, null will be returned
 */
export function resolveAlias(
  repository: string,
  registryAliases: Record<string, string>,
): string | null {
  if (!isAlias(repository)) {
    return repository;
  }

  const repoWithPrefixRemoved = repository.slice(repository[0] === '@' ? 1 : 6);
  const alias = registryAliases[repoWithPrefixRemoved];
  if (alias) {
    return alias;
  }
  return null;
}

export function getRepositories(definitions: ChartDefinition[]): Repository[] {
  const repositoryList = definitions
    .flatMap((value) => value.dependencies)
    .filter((dependency) => dependency.repository) // only keep non-local references --> if no repository is defined the chart will be searched in charts/<name>
    .filter((dependency) => !isAlias(dependency.repository)) // do not add registryAliases
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

export function isOCIRegistry(
  repository: Repository | string | null | undefined,
): boolean {
  if (is.nullOrUndefined(repository)) {
    return false;
  }
  const repo = is.string(repository) ? repository : repository.repository;
  return repo.startsWith('oci://');
}

export function aliasRecordToRepositories(
  registryAliases: Record<string, string>,
): Repository[] {
  return Object.entries(registryAliases).map(([alias, url]) => {
    return {
      name: alias,
      repository: url,
    };
  });
}

export function isFileInDir(dir: string, file: string): boolean {
  return upath.dirname(file) === dir;
}
