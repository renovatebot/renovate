import semver, { SemVer } from 'semver';
import stable from 'semver-stable';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver-coerced';
export const displayName = 'Coerced Semantic';
export const urls = ['https://semver.org/'];
export const supportsRanges = false;

const { is: isStable } = stable;

function sortVersions(a: string, b: string): number {
  return semver.compare(semver.coerce(a), semver.coerce(b));
}

function getMajor(a: string | SemVer): number | null {
  return semver.major(semver.coerce(a));
}

function getMinor(a: string | SemVer): number | null {
  return semver.minor(semver.coerce(a));
}

function getPatch(a: string | SemVer): number | null {
  return semver.patch(a);
}

function matches(version: string, range: string): boolean {
  return semver.satisfies(semver.coerce(version), range);
}

function equals(a: string, b: string): boolean {
  return semver.eq(semver.coerce(a), semver.coerce(b));
}

function isValid(version: string): string | boolean | null {
  return semver.valid(semver.coerce(version));
}

const {
  maxSatisfying: getSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  valid,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isVersion = (input: string): string | boolean => isValid(input);

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
  isSingleVersion: valid,
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
