import semver from 'semver';
import stable from 'semver-stable';

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
export const isVersion = input => valid(input);

export { isVersion as isValid, maxSatisfyingVersion };

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
  return toVersion;
}

/** @type import('../common').VersioningApi */
export const api = {
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
