import semver from 'semver';
import stable from 'semver-stable';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver';
export const displayName = 'Semantic';
export const urls = ['https://semver.org/'];
export const supportsRanges = false;

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying: getSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  satisfies: matches,
  valid,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  eq: equals,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isVersion = (input: string): string => valid(input);

export { isVersion as isValid, getSatisfyingVersion };

function getNewValue({ newVersion }: NewValueConfig): string {
  return newVersion;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion: isVersion,
  isStable,
  isValid: isVersion,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
