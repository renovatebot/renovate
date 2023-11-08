import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import { api as npm } from '../npm';
import { api as pep440 } from '../pep440';
import type { NewValueConfig, VersioningApi } from '../types';

import {
  ascendingRange,
  descendingRange,
  exactVersion,
  inclusiveBound,
  lowerBound,
  upperBound,
  versionGroup,
} from './pattern';
import {
  npm2rezplus,
  padZeroes,
  pep4402rezInclusiveBound,
  rez2npm,
  rez2pep440,
} from './transform';

export const id = 'rez';
export const displayName = 'rez';
export const urls = ['https://github.com/nerdvegas/rez'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

function equals(a: string, b: string): boolean {
  try {
    return npm.equals(padZeroes(a), padZeroes(b));
  } catch (err) /* istanbul ignore next */ {
    return pep440.equals(a, b);
  }
}

function getMajor(version: string): number | null {
  try {
    return npm.getMajor(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getMajor(version);
  }
}

function getMinor(version: string): number | null {
  try {
    return npm.getMinor(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getMinor(version);
  }
}

function getPatch(version: string): number | null {
  try {
    return npm.getPatch(padZeroes(version));
  } catch (err) /* istanbul ignore next */ {
    return pep440.getPatch(version);
  }
}

function isGreaterThan(a: string, b: string): boolean {
  try {
    return npm.isGreaterThan(padZeroes(a), padZeroes(b));
  } catch (err) /* istanbul ignore next */ {
    return pep440.isGreaterThan(a, b);
  }
}

function isLessThanRange(version: string, range: string): boolean {
  return (
    npm.isVersion(padZeroes(version)) &&
    !!npm.isLessThanRange?.(padZeroes(version), rez2npm(range))
  );
}

export function isValid(input: string): boolean {
  return npm.isValid(rez2npm(input));
}

function isStable(version: string): boolean {
  return npm.isStable(padZeroes(version));
}

function isVersion(input: string): boolean {
  return npm.isVersion(padZeroes(rez2npm(input)));
}

function matches(version: string, range: string): boolean {
  return (
    npm.isVersion(padZeroes(version)) &&
    npm.matches(padZeroes(version), rez2npm(range))
  );
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, rez2npm(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions, rez2npm(range));
}

function isSingleVersion(constraint: string): boolean {
  return (
    (constraint.trim().startsWith('==') &&
      isVersion(constraint.trim().substring(2).trim())) ||
    isVersion(constraint.trim())
  );
}

function sortVersions(a: string, b: string): number {
  return npm.sortVersions(padZeroes(a), padZeroes(b));
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  const pep440Value = pep440.getNewValue({
    currentValue: rez2pep440(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (exactVersion.test(currentValue)) {
    return pep440Value;
  }
  if (pep440Value && inclusiveBound.test(currentValue)) {
    return pep4402rezInclusiveBound(pep440Value);
  }
  if (pep440Value && lowerBound.test(currentValue)) {
    if (currentValue.includes('+')) {
      return npm2rezplus(pep440Value);
    }
    return pep440Value;
  }
  if (pep440Value && upperBound.test(currentValue)) {
    return pep440Value;
  }
  const matchAscRange = ascendingRange.exec(currentValue);
  if (pep440Value && matchAscRange?.groups) {
    // Replace version numbers but keep rez format, otherwise we just end up trying
    // to convert every single case separately.
    const lowerBoundAscCurrent = matchAscRange.groups.range_lower_asc;
    const upperBoundAscCurrent = matchAscRange.groups.range_upper_asc;
    const lowerAscVersionCurrent = matchAscRange.groups.range_lower_asc_version;
    const upperAscVersionCurrent = matchAscRange.groups.range_upper_asc_version;
    const [lowerBoundAscPep440, upperBoundAscPep440] = pep440Value.split(', ');
    const lowerAscVersionNew = coerceString(
      regEx(versionGroup).exec(lowerBoundAscPep440)?.[0],
    );
    const upperAscVersionNew = coerceString(
      regEx(versionGroup).exec(upperBoundAscPep440)?.[0],
    );
    const lowerBoundAscNew = lowerBoundAscCurrent.replace(
      lowerAscVersionCurrent,
      lowerAscVersionNew,
    );
    const upperBoundAscNew = upperBoundAscCurrent.replace(
      upperAscVersionCurrent,
      upperAscVersionNew,
    );
    const separator = currentValue.includes(',') ? ',' : '';

    return lowerBoundAscNew + separator + upperBoundAscNew;
  }
  const matchDscRange = descendingRange.exec(currentValue);
  if (pep440Value && matchDscRange?.groups) {
    // Replace version numbers but keep rez format, otherwise we just end up trying
    // to convert every single case separately.
    const upperBoundDescCurrent = matchDscRange.groups.range_upper_desc;
    const lowerBoundDescCurrent = matchDscRange.groups.range_lower_desc;
    const upperDescVersionCurrent =
      matchDscRange.groups.range_upper_desc_version;
    const lowerDescVersionCurrent =
      matchDscRange.groups.range_lower_desc_version;
    const [lowerBoundDescPep440, upperBoundDescPep440] =
      pep440Value.split(', ');

    const upperDescVersionNew = coerceString(
      regEx(versionGroup).exec(upperBoundDescPep440)?.[0],
    );
    const lowerDescVersionNew = coerceString(
      regEx(versionGroup).exec(lowerBoundDescPep440)?.[0],
    );
    const upperBoundDescNew = upperBoundDescCurrent.replace(
      upperDescVersionCurrent,
      upperDescVersionNew,
    );
    const lowerBoundDescNew = lowerBoundDescCurrent.replace(
      lowerDescVersionCurrent,
      lowerDescVersionNew,
    );
    // Descending ranges are only supported with a comma.
    const separator = ',';

    return upperBoundDescNew + separator + lowerBoundDescNew;
  }
  return null;
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  getNewValue,
  getSatisfyingVersion,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  minSatisfyingVersion,
  sortVersions,
};
export default api;
