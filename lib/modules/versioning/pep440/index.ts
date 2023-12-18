import * as pep440 from '@renovatebot/pep440';
import type { RangeStrategy } from '../../../types/versioning';
import type { VersioningApi } from '../types';
import { getNewValue, isLessThanRange } from './range';

export const id = 'pep440';
export const displayName = 'PEP440';
export const urls = ['https://www.python.org/dev/peps/pep-0440/'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

const {
  compare: sortVersions,
  satisfies: matches,
  valid,
  validRange,
  explain,
  gt: isGreaterThan,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  eq,
} = pep440;

function isVersion(input: string | undefined | null): boolean {
  // @renovatebot/pep440 isn't strict null save
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return !!valid(input!);
}

const isStable = (input: string): boolean => {
  const version = explain(input);
  if (!version) {
    return false;
  }
  return !version.is_prerelease;
};

// If this is left as an alias, inputs like "17.04.0" throw errors
export function isValid(input: string): boolean {
  return validRange(input) || isVersion(input);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const found = pep440.filter(versions, range).sort(sortVersions);
  return found.length === 0 ? null : found[found.length - 1];
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const found = pep440.filter(versions, range).sort(sortVersions);
  return found.length === 0 ? null : found[0];
}

export function isSingleVersion(constraint: string): boolean {
  return (
    isVersion(constraint) ||
    (constraint?.startsWith('==') && isVersion(constraint.substring(2).trim()))
  );
}

export { isVersion, matches };

const equals = (version1: string, version2: string): boolean =>
  isVersion(version1) && isVersion(version2) && eq(version1, version2);

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
  isLessThanRange,
};

export default api;
