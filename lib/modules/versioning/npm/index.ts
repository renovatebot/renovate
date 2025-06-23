import semver from 'semver';
import stable from 'semver-stable';
import type { RangeStrategy } from '../../../types/versioning';
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
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

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
  subset,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = (input: string): boolean => !!validRange(input);
export const isVersion = (input: string): boolean => !!valid(input);

function isSingleVersion(constraint: string): boolean {
  return (
    isVersion(constraint) ||
    (constraint?.startsWith('=') && isVersion(constraint.substring(1).trim()))
  );
}

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
  isStable: stable.is,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
  subset,
};

export default api;
