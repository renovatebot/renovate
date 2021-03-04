import * as pep440 from '@renovate/pep440';
import { filter } from '@renovate/pep440/lib/specifier';
import type { VersioningApi } from '../types';
import { getNewValue } from './range';

export const id = 'pep440';
export const displayName = 'PEP440';
export const urls = ['https://www.python.org/dev/peps/pep-0440/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

const {
  compare: sortVersions,
  satisfies: matches,
  valid: isVersion,
  validRange,
  explain,
  gt: isGreaterThan,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  eq,
} = pep440;

const isStable = (input: string): boolean => {
  const version = explain(input);
  if (!version) {
    return false;
  }
  return !version.is_prerelease;
};

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = (input: string): string =>
  validRange(input) || isVersion(input);

const getSatisfyingVersion = (versions: string[], range: string): string => {
  const found = filter(versions, range).sort(sortVersions);
  return found.length === 0 ? null : found[found.length - 1];
};

const minSatisfyingVersion = (versions: string[], range: string): string => {
  const found = filter(versions, range).sort(sortVersions);
  return found.length === 0 ? null : found[0];
};

export const isSingleVersion = (constraint: string): string =>
  isVersion(constraint) ||
  (constraint.startsWith('==') && isVersion(constraint.substring(2).trim()));

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
};

export default api;
