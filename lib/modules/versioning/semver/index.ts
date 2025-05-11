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
export const isVersion = (input: string): boolean => !!valid(input);

export { isVersion as isValid, getSatisfyingVersion };

function getNewValue({
  currentValue,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (currentVersion === `v${currentValue}`) {
    return newVersion.replace(/^v/, '');
  }
  return newVersion;
}

export function isBreaking(current: string, version: string): boolean {
  // The change may be breaking if either version is unstable
  if (!isStable(version) || !isStable(current)) {
    return true;
  }
  const currentMajor = getMajor(current);
  if (currentMajor === 0) {
    // All v0.x updates might be breaking
    return true;
  }
  // Otherwise, only major updates are breaking
  return currentMajor !== getMajor(version);
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

function isSingleVersion(version: string): boolean {
  return isVersion(version);
}

function isValid(input: string): boolean {
  return isVersion(input);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isBreaking,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
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
