import semver from 'semver';
import stable from 'semver-stable';
import type { VersioningApi } from '../types';
import { getNewValue, toSemverRange } from './range';

export const id = 'swift';
export const displayName = 'Swift';
export const urls = ['https://swift.org/package-manager/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

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

export const isValid = (input: string): boolean =>
  !!valid(input) || !!validRange(toSemverRange(input));
export const isVersion = (input: string): boolean => !!valid(input);
const getSatisfyingVersion = (versions: string[], range: string): string =>
  maxSatisfying(
    versions.map((v) => v.replace(/^v/, '')),
    toSemverRange(range)
  );
const minSatisfyingVersion = (versions: string[], range: string): string =>
  minSatisfying(
    versions.map((v) => v.replace(/^v/, '')),
    toSemverRange(range)
  );
const isLessThanRange = (version: string, range: string): boolean =>
  ltr(version, toSemverRange(range));
const matches = (version: string, range: string): boolean =>
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
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
