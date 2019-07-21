import * as semver from 'semver';
import { is as isStable } from 'semver-stable';
import { getNewValue } from './range';

const {
  compare: sortVersions,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  satisfies: matches,
  valid,
  validRange,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  eq: equals,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = input => validRange(input);
export const isVersion = input => valid(input);

const isSingleVersion = constraint =>
  isVersion(constraint) ||
  (constraint.startsWith('=') && isVersion(constraint.substring(1).trim()));

/** @type import('../common').VersioningApi */
export const api = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
