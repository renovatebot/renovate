import semver from 'semver';
import stable from 'semver-stable';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver';
export const displayName = 'Semantic';
export const urls = ['https://semver.org/'];
export const supportsRanges = false;

const { is: isStable } = stable;

function sortVersions(a: string, b: string): boolean {
  return semver.compare(semver.coerce(a), semver.coerce(b));
}

function getMajor(a: string, loose: boolean): string {
  return semver.major(semver.coerce(a), loose);
}

function getMinor(a: string, loose: boolean): string {
  return semver.minor(semver.coerce(a), loose);
}

function getPatch(a: string, loose: boolean): string {
  return semver.patch(a, loose);
}

function matches(version: string, range: string, options: any): boolean {
  return semver.satisfies(semver.coerce(version), range, options);
}

function equals(a: string, b: string, loose: boolean) {
  return semver.eq(semver.coerce(a), semver.coerce(b), loose);
}

function isValid(version: string, options: any) {
  return semver.valid(semver.coerce(version), version, options);
}

const {
  maxSatisfying: getSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  valid,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isVersion = (input: string): string => isValid(input);

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
