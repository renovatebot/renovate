import { isNullOrUndefined, isString } from '@sindresorhus/is';
import type { Repository } from './types';

export function isOCIRegistry(
  repository: Repository | string | null | undefined,
): boolean {
  if (isNullOrUndefined(repository)) {
    return false;
  }
  const repo = isString(repository) ? repository : repository.repository;
  return repo.startsWith('oci://');
}

export function removeOCIPrefix(repository: string): string {
  if (isOCIRegistry(repository)) {
    return repository.replace('oci://', '');
  }
  return repository;
}
