import semver from 'semver';
import stable from 'semver-stable';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { normalizeLegacyXRanges } from '../semver/common.ts';
import { isBreaking } from '../semver/index.ts';
import type { VersioningApi } from '../types.ts';
import { getNewValue } from './range.ts';

export const id = 'npm';
export const displayName = 'npm';
export const urls = [
  '[Semantic Versioning](https://semver.org/)',
  '[semver npm package](https://www.npmjs.com/package/semver)',
  '[npm - About semantic versioning](https://docs.npmjs.com/about-semantic-versioning)',
  '[npm semver calculator](https://semver.npmjs.com/)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
];

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
  subset: semverSubset,
  intersects: semverIntersects,
} = semver;

function normalizeNpmRange(range: string): string {
  return normalizeLegacyXRanges(range);
}

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = (input: string): boolean =>
  !!validRange(normalizeNpmRange(input));
export const isVersion = (input: string): boolean => !!valid(input);

function matches(version: string, range: string): boolean {
  return satisfies(version, normalizeNpmRange(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return maxSatisfying(versions, normalizeNpmRange(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return minSatisfying(versions, normalizeNpmRange(range));
}

function isLessThanRange(version: string, range: string): boolean {
  return ltr(version, normalizeNpmRange(range));
}

function subset(subRange: string, superRange: string): boolean | undefined {
  return semverSubset(
    normalizeNpmRange(subRange),
    normalizeNpmRange(superRange),
  );
}

function intersects(range1: string, range2: string): boolean {
  return semverIntersects(normalizeNpmRange(range1), normalizeNpmRange(range2));
}

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
  isBreaking,
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
  intersects,
};

export default api;
