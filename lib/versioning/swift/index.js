import semver from 'semver';
import stable from 'semver-stable';
import { toSemverRange, getNewValue } from './range';

const { is: isStable } = stable;

const {
  compare: sortVersions,
  maxSatisfying,
  minSatisfying,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  satisfies,
  valid,
  validRange,
  ltr,
  gt: isGreaterThan,
  eq: equals,
} = semver;

/** @type any */
export const isValid = input =>
  !!valid(input) || !!validRange(toSemverRange(input));
export const isVersion = input => !!valid(input);
/** @type any */
const maxSatisfyingVersion = (versions, range) =>
  maxSatisfying(versions, toSemverRange(range));
/** @type any */
const minSatisfyingVersion = (versions, range) =>
  minSatisfying(versions, toSemverRange(range));
const isLessThanRange = (version, range) => ltr(version, toSemverRange(range));
const matches = (version, range) => satisfies(version, toSemverRange(range));

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
  isSingleVersion: isVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
