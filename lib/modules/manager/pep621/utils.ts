import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';

const pep508Regex = regEx(
  /^(?<packageName>[A-Z0-9._-]+)\s*(\[[A-Z0-9,._-]+\])?\s*(?<currentValue>[^;]+)(;(?<environmentMarker>.*))?/i
);

export function parsePEP508(value: string): PackageDependency | null {
  const result = pep508Regex.exec(value);
  if (is.nullOrUndefined(result)) {
    // TODO logging
    return null;
  }

  return {};
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
    const dep = parsePEP508(element);
    if (is.truthy(dep)) {
      deps.push(dep);
    }
  }
  return deps;
}
