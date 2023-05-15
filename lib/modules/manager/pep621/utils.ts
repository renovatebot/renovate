import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import type { PackageDependency } from '../types';
import type { Pep508ParseResult } from './types';

const pep508Regex = regEx(
  /^(?<packageName>[A-Z0-9._-]+)\s*(\[(?<extras>[A-Z0-9,._-]+)\])?\s*(?<currentValue>[^;]+)?(;\s*(?<marker>.*))?/i
);

export function parsePEP508(
  value: string | null | undefined
): Pep508ParseResult | null {
  if (is.nullOrUndefined(value)) {
    return null;
  }

  const regExpExec = pep508Regex.exec(value);
  if (
    is.nullOrUndefined(regExpExec) ||
    is.nullOrUndefined(regExpExec?.groups)
  ) {
    logger.trace(`Pep508 could not be extracted`);
    return null;
  }

  const result: Pep508ParseResult = {
    packageName: regExpExec.groups.packageName,
  };
  if (is.nonEmptyString(regExpExec.groups.currentValue)) {
    result.currentValue = regExpExec.groups.currentValue;
  }
  if (is.nonEmptyString(regExpExec.groups.marker)) {
    result.marker = regExpExec.groups.marker;
  }
  if (is.nonEmptyString(regExpExec.groups.extras)) {
    result.extras = regExpExec.groups.extras.split(',');
  }

  return result;
}

export function pep508ToPackageDependency(
  depType: string,
  value: string
): PackageDependency | null {
  const parsed = parsePEP508(value);
  if (is.nullOrUndefined(parsed)) {
    return null;
  }

  const dep: PackageDependency = {
    packageName: parsed.packageName,
    depName: parsed.packageName,
    datasource: PypiDatasource.id,
    depType,
  };

  if (is.nullOrUndefined(parsed.currentValue)) {
    dep.skipReason = 'any-version';
  } else {
    dep.currentValue = parsed.currentValue;
  }
  return dep;
}

export function parseDependencyGroupRecord(
  depType: string,
  records: Record<string, string[]> | null | undefined
): PackageDependency[] {
  if (is.nullOrUndefined(records)) {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const [groupName, pep508Strings] of Object.entries(records)) {
    for (const dep of parseDependencyList(depType, pep508Strings)) {
      deps.push({ ...dep, depName: `${groupName}/${dep.packageName!}` });
    }
  }
  return deps;
}

export function parseDependencyList(
  depType: string,
  list: string[] | null | undefined
): PackageDependency[] {
  if (is.nullOrUndefined(list)) {
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const element of list) {
    const dep = pep508ToPackageDependency(depType, element);
    if (is.truthy(dep)) {
      deps.push(dep);
    }
  }
  return deps;
}
