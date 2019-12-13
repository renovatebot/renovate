import semver from 'semver';
import stable from 'semver-stable';
import { RangeStrategy, VersioningApi } from '../common';

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying: maxSatisfyingVersion,
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

export { isVersion as isValid, maxSatisfyingVersion };

function getNewValue(
  _currentValue: string,
  _rangeStrategy: RangeStrategy,
  _fromVersion: string,
  toVersion: string
): string {
  return toVersion;
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
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
