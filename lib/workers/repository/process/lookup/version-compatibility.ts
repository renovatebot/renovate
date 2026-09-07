import { isString } from '@sindresorhus/is';
import { logger } from '../../../../logger/index.ts';
import type { LookupUpdate } from '../../../../modules/manager/types.ts';
import { regEx } from '../../../../util/regex.ts';

export interface VersionCompatibilityMatch {
  /** The version part of `currentValue`, to be compared against the datasource's versions */
  compareValue: string | undefined;
  /** The compatibility part of `currentValue`, e.g. `-alpine` */
  currentCompatibility: string | undefined;
}

/**
 * Split `currentValue` into its version and compatibility parts using the
 * `versionCompatibility` regex.
 *
 * Returns `null` when `versionCompatibility` is not configured or does not
 * match, in which case `currentValue` is compared as-is.
 */
export function matchVersionCompatibility(config: {
  currentValue?: string;
  versionCompatibility?: string;
  packageName?: string;
}): VersionCompatibilityMatch | null {
  const { currentValue, packageName, versionCompatibility } = config;
  if (!isString(currentValue) || !isString(versionCompatibility)) {
    return null;
  }

  const regexMatch = regEx(versionCompatibility).exec(currentValue);
  if (!regexMatch?.groups) {
    logger.debug(
      { versionCompatibility, currentValue, packageName },
      'version compatibility regex mismatch',
    );
    return null;
  }

  logger.debug(
    {
      versionCompatibility,
      currentValue,
      packageName,
      groups: regexMatch.groups,
    },
    'version compatibility regex match',
  );
  return {
    compareValue: regexMatch.groups.version,
    currentCompatibility: regexMatch.groups.compatibility,
  };
}

/**
 * Put the compatibility part back onto each update's `newValue`, undoing the
 * split performed by `matchVersionCompatibility()`.
 */
export function restoreVersionCompatibility(
  config: { currentValue?: string; versionCompatibility?: string },
  compareValue: string | undefined,
  updates: LookupUpdate[],
): void {
  const { currentValue, versionCompatibility } = config;
  if (
    !isString(currentValue) ||
    !isString(compareValue) ||
    !isString(versionCompatibility)
  ) {
    return;
  }

  for (const update of updates) {
    logger.debug({ update });
    // v8 ignore else -- TODO: add test #40625
    if (isString(update.newValue)) {
      update.newValue = currentValue.replace(compareValue, update.newValue);
    }
  }
}
