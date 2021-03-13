import * as semver from 'semver';
import { is as isStable } from 'semver-stable';
import type { VersioningApi } from '../types';
import { getNewValue } from './range';

export const id = 'npm';
export const displayName = 'npm';
export const urls = [
  'https://semver.org/',
  'https://www.npmjs.com/package/semver',
  'https://docs.npmjs.com/about-semantic-versioning',
  'https://semver.npmjs.com/',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

const {
  compare: sortVersions,
  maxSatisfying: getSatisfyingVersion,
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
export const isValid = (input: string): string => validRange(input);
export const isVersion = (input: string): string => valid(input);

const isSingleVersion = (constraint: string): string =>
  isVersion(constraint) ||
  (constraint.startsWith('=') && isVersion(constraint.substring(1).trim()));

export const api: VersioningApi = {
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
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
};

export default api;
