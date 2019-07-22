import semver from 'semver';
import stable from 'semver-stable';
import { toSemverRange, getNewValue } from './range';
import { VersioningApi } from '../common';

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

export const isValid = (input: string) =>
  !!valid(input) || !!validRange(toSemverRange(input));
export const isVersion = (input: string) => !!valid(input);
const maxSatisfyingVersion = (versions: string[], range: string) =>
  maxSatisfying(versions, toSemverRange(range));
const minSatisfyingVersion = (versions: string[], range: string) =>
  minSatisfying(versions, toSemverRange(range));
const isLessThanRange = (version: string, range: string) =>
  ltr(version, toSemverRange(range));
const matches = (version: string, range: string) =>
  satisfies(version, toSemverRange(range));

export const api: VersioningApi = {
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
