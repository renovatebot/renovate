import * as datasourceDocker from '../../datasource/docker';
import { logger } from '../../logger';
import type { PackageDependency } from '../types';

export function parseRepository(
  depName: string,
  repositoryURL: string
): PackageDependency {
  const res: PackageDependency = {};

  try {
    const url = new URL(repositoryURL);
    switch (url.protocol) {
      case 'oci:':
        res.datasource = datasourceDocker.id;
        res.lookupName = `${repositoryURL.replace('oci://', '')}/${depName}`;
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
  if (!(repository.startsWith('@') || repository.startsWith('alias:'))) {
    return repository;
  }

  const repoWithPrefixRemoved = repository.slice(repository[0] === '@' ? 1 : 6);
  const alias = aliases[repoWithPrefixRemoved];
  if (alias) {
    return alias;
  }
  return null;
}
