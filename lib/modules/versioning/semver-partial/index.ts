import is from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver-partial';
export const displayName = 'Partial Semantic Versioning';
export const urls = [
  'https://docs.gitlab.com/ci/components/#partial-semantic-versions',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'bump', 'replace'];

function isLatest(input: string): boolean {
  return input === '~latest';
}

function massage(input: string): string {
  return input.replace(regEx(/^v?/), '');
}

function parseVersion(input: string): SemVer | null {
  return semver.parse(massage(input));
}

interface Range {
  major: number;
  minor?: number;
}

function parseRange(input: string): Range | null {
  const range = massage(input);
  const coerced = semver.coerce(range);
  if (!coerced) {
    return null;
  }
  const { major, minor } = coerced;

  if (regEx(/^\d+$/).test(range)) {
    return { major };
  }

  return { major, minor };
}

function isValid(input: string): boolean {
  return isLatest(input) || !!parseVersion(input) || !!parseRange(input);
}

function isVersion(input: string | undefined | null): boolean {
  if (!input) {
    return false;
  }

  return !!parseVersion(input);
}

function isStable(version: string): boolean {
  const v = parseVersion(version);
  if (!v) {
    return false;
  }

  return v.prerelease.length === 0;
}

function isSingleVersion(input: string): boolean {
  return isVersion(input);
}

function getMajor(version: string): number | null {
  return parseVersion(version)?.major ?? null;
}

function getMinor(version: string): number | null {
  return parseVersion(version)?.minor ?? null;
}

function getPatch(version: string): number | null {
  return parseVersion(version)?.patch ?? null;
}

function sortVersions(x: string, y: string): number {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return 0;
  }
  return semver.compare(a, b);
}

function equals(x: string, y: string): boolean {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return false;
  }
  return semver.eq(a, b);
}

function isGreaterThan(x: string, y: string): boolean {
  const a = parseVersion(x);
  const b = parseVersion(y);
  if (!a || !b) {
    return false;
  }
  return semver.gt(a, b);
}

function matches(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }

  if (isLatest(range)) {
    return true;
  }

  const v = parseVersion(version);
  if (!v) {
    return false;
  }

  const rv = parseVersion(range);
  if (rv) {
    return semver.eq(v, rv);
  }

  const r = parseRange(range);
  if (!r) {
    return false;
  }

  if (v.prerelease.length > 0) {
    return false;
  }

  if (v.major !== r.major) {
    return false;
  }

  if (is.undefined(r.minor)) {
    return true;
  }

  return v.minor === r.minor;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const sortedVersions = versions.sort(sortVersions).reverse();
  for (const version of sortedVersions) {
    if (matches(version, range)) {
      return version;
    }
  }
  return null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const sortedVersions = versions.sort(sortVersions);
  for (const version of sortedVersions) {
    if (matches(version, range)) {
      return version;
    }
  }
  return null;
}

function isLessThanRange(version: string, range: string): boolean {
  const v = semver.parse(version);
  const r = semver.coerce(range);

  if (!v || !r) {
    return false;
  }

  if (v.major !== r.major) {
    return v.major < r.major;
  }

  if (is.undefined(r.minor)) {
    return false;
  }

  if (v.minor !== r.minor) {
    return v.minor < r.minor;
  }

  return false;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    return newVersion;
  }

  if (currentValue === '~latest') {
    return '~latest';
  }

  const partialMatch = /^v?(\d+)(?:\.(\d+))?$/.exec(currentValue);
  if (partialMatch) {
    const newParsed = semver.coerce(newVersion);
    if (!newParsed) {
      return newVersion;
    }
    if (rangeStrategy === 'bump') {
      return newVersion;
    }

    const minor = partialMatch[2];
    const prefix = currentValue.startsWith('v') ? 'v' : '';

    if (minor === undefined) {
      return `${prefix}${newParsed.major}`;
    }
    return `${prefix}${newParsed.major}.${newParsed.minor}`;
  }

  if (currentVersion === `v${currentValue}`) {
    return newVersion.replace(/^v/, '');
  }
  return newVersion;
}

function isCompatible(version: string): boolean {
  return isValid(version);
}

function isBreaking(version: string, current: string): boolean {
  const versionParsed = semver.coerce(version);
  const currentParsed = semver.coerce(current);

  if (!versionParsed || !currentParsed) {
    return false;
  }

  if (currentParsed.major === 0) {
    return versionParsed.major > 0 || versionParsed.minor > currentParsed.minor;
  }

  return versionParsed.major > currentParsed.major;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isBreaking,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};

export default api;
