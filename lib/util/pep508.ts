import { RANGE_PATTERN } from '@renovatebot/pep440';
import { isNonEmptyString, isNullOrUndefined } from '@sindresorhus/is';
import { logger } from '../logger/index.ts';
import { normalizePythonDepName } from '../modules/datasource/pypi/common.ts';
import { PypiDatasource } from '../modules/datasource/pypi/index.ts';
import type { PackageDependency } from '../modules/manager/types.ts';
import { regEx } from './regex.ts';

export interface Pep508ParseResult {
  packageName: string;
  currentValue?: string;
  extras?: string[];
  marker?: string;
}

/**
 * Package name, based on https://www.python.org/dev/peps/pep-0508/#names
 */
export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';

const extrasGroupPattern = '(?:\\s*\\[[^\\]]+\\])';

/** A single, optional extras group such as `[socks]`. */
export const extrasPattern = `${extrasGroupPattern}?`;

/** Zero or more extras groups, e.g. `[socks][speedups]`. */
export const repeatedExtrasPattern = `${extrasGroupPattern}*`;

/**
 * `RANGE_PATTERN` with its named groups turned into non-capturing ones, which
 * keeps regex memory usage down when the group names are not needed.
 */
export const rangePattern: string = RANGE_PATTERN.replace(
  regEx(/\(\?<\w+>/g),
  '(?:',
);

const specifierPartPattern = `\\s*${rangePattern}`;

/** A comma separated list of version specifiers, e.g. `>=1.0, !=1.2`. */
export const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;

/**
 * Name, extras and version specifiers, each in its own capture group.
 * The specifier group is optional.
 */
export const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})?`;

const pep508Regex = regEx(
  /^(?<packageName>[A-Z0-9._-]+)\s*(?:\[(?<extras>[A-Z0-9\s,._-]+)\])?\s*(?<currentValue>[^;]+)?(?:;\s*(?<marker>.*))?/i,
);

export function parsePep508(
  value: string | null | undefined,
): Pep508ParseResult | null {
  if (isNullOrUndefined(value)) {
    return null;
  }

  const regExpExec = pep508Regex.exec(value);
  if (isNullOrUndefined(regExpExec) || isNullOrUndefined(regExpExec?.groups)) {
    logger.trace(`Pep508 could not be extracted`);
    return null;
  }

  const result: Pep508ParseResult = {
    packageName: regExpExec.groups.packageName,
  };
  if (isNonEmptyString(regExpExec.groups.currentValue)) {
    if (
      regExpExec.groups.currentValue.startsWith('(') &&
      regExpExec.groups.currentValue.endsWith(')')
    ) {
      result.currentValue = regExpExec.groups.currentValue.slice(1, -1).trim();
    } else {
      result.currentValue = regExpExec.groups.currentValue;
    }
  }

  if (isNonEmptyString(regExpExec.groups.marker)) {
    result.marker = regExpExec.groups.marker;
  }
  if (isNonEmptyString(regExpExec.groups.extras)) {
    // trim to remove allowed whitespace between brackets
    result.extras = regExpExec.groups.extras.split(',').map((e) => e.trim());
  }

  return result;
}

/**
 * Returns the pinned version of a `==` specifier, or `undefined` when the
 * value is not pinned.
 */
export function extractPinnedVersion(
  currentValue: string | null | undefined,
): string | undefined {
  if (!currentValue?.startsWith('==')) {
    return undefined;
  }
  return currentValue.replace(regEx(/^==\s*/), '');
}

/**
 * Builds a PyPI dependency, normalizing the package name and pinning
 * `currentVersion` for `==` specifiers.
 */
export function pypiDependency(
  depName: string,
  currentValue?: string,
  depType?: string,
): PackageDependency {
  const dep: PackageDependency = {
    depName,
    packageName: normalizePythonDepName(depName),
    currentValue,
    datasource: PypiDatasource.id,
  };

  if (!isNullOrUndefined(depType)) {
    dep.depType = depType;
  }

  const currentVersion = extractPinnedVersion(currentValue);
  if (!isNullOrUndefined(currentVersion)) {
    dep.currentVersion = currentVersion;
  }

  return dep;
}

export function pep508ToPackageDependency(
  depType: string,
  value: string,
): PackageDependency | null {
  const parsed = parsePep508(value);
  if (isNullOrUndefined(parsed)) {
    return null;
  }

  const dep = pypiDependency(parsed.packageName, parsed.currentValue, depType);
  if (isNullOrUndefined(parsed.currentValue)) {
    // leave `currentValue` unset entirely, so that callers such as poetry can
    // still enrich the dependency with a value of their own
    delete dep.currentValue;
    dep.skipReason = 'unspecified-version';
  }
  return dep;
}
