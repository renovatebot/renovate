import is from '@sindresorhus/is';
import type { Repository } from './types';

export function isOCIRegistry(
  repository: Repository | string | null | undefined,
): boolean {
  if (is.nullOrUndefined(repository)) {
    return false;
  }
  const repo = is.string(repository) ? repository : repository.repository;
  return repo.startsWith('oci://');
}

export function removeOCIPrefix(repository: string): string {
  if (isOCIRegistry(repository)) {
    return repository.replace('oci://', '');
  }
  return repository;
}
