import is from '@sindresorhus/is';
import type { PackageDependency } from '../types';

export function parsePEP508(value: string): PackageDependency {
  // TODO implement
}

export function parseDependencyGroupRecord(
  records: Record<string, string[]> | null | undefined
): PackageDependency[] {
  if (is.nullOrUndefined(records)) {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const [, pep508Strings] of Object.entries(records)) {
    deps.push(...parseDependencyList(pep508Strings));
  }
  return deps;
}

export function parseDependencyList(
  list: string[] | null | undefined
): PackageDependency[] {
  if (is.nullOrUndefined(list)) {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const element of list) {
    deps.push(parsePEP508(element));
  }
  return deps;
}
