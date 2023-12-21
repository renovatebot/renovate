import semver from 'semver';
import stable from 'semver-stable';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import type { VersioningApi } from '../types';
import { getNewValue, toSemverRange } from './range';

export const id = 'swift';
export const displayName = 'Swift';
export const urls = ['https://swift.org/package-manager/'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

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

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const normalizedVersions = versions.map((v) => v.replace(regEx(/^v/), ''));
  const semverRange = toSemverRange(range);
  return semverRange ? maxSatisfying(normalizedVersions, semverRange) : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const normalizedVersions = versions.map((v) => v.replace(regEx(/^v/), ''));
  const semverRange = toSemverRange(range);
  return semverRange ? minSatisfying(normalizedVersions, semverRange) : null;
}

function isLessThanRange(version: string, range: string): boolean {
  const semverRange = toSemverRange(range);
  return semverRange ? ltr(version, semverRange) : false;
}

function matches(version: string, range: string): boolean {
  const semverRange = toSemverRange(range);
  return semverRange ? satisfies(version, semverRange) : false;
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
