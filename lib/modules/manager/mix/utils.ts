import type { Registry } from './types';

/**
 * Resolves alias in repository string.
 *
 * @param repository to be resolved string
 * @param registryAliases Records containing registryAliases as key and to be resolved URLs as values
 *
 * @returns  resolved alias. If repository does not contain an alias the repository string will be returned. Should it contain an alias which can not be resolved using `registryAliases`, null will be returned
 */
export function resolveAlias(
  packageName: string,
  registryAliases: Record<string, string>,
): string | null {
  if (!isAlias(packageName)) {
    return packageName;
  }

  const [, repoName, ,] = packageName.split(':');
  const alias = registryAliases[repoName];

  if (alias) {
    return alias;
  }
  return null;
}

export function isAlias(packageName: string): boolean {
  return packageName.startsWith('repo:');
}

//
export function aliasRecordToRepositories(
  registryAliases: Record<string, string>,
): Registry[] {
  return Object.entries(registryAliases).map(([alias, url]) => {
    return {
      name: alias,
      registry: url,
    };
  });
}
