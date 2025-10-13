import is from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import stable from 'semver-stable';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver-partial';
export const displayName = 'Partial Semantic Versioning';
export const urls = [
  'https://docs.gitlab.com/ci/components/#partial-semantic-versions',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'bump', 'replace'];

function isPartialVersion(input: string): boolean {
  return /^v?(\d+)(?:\.(\d+))?$/.test(input);
}

function isStable(version: string): boolean {
  // Check for prerelease indicators in the original string
  if (/-(?:alpha|beta|rc|pre|dev|snapshot|unstable)/i.test(version)) {
    return false;
  }

  const parsed = semver.parse(version);
  if (parsed && parsed.prerelease.length > 0) {
    return false;
  }
  const coerced = semver.coerce(version);
  return coerced ? stable.is(coerced.version) : false;
}

function isValid(input: string): boolean {
  return (
    input === '~latest' || isPartialVersion(input) || !!semver.coerce(input)
  );
}

function isVersion(input: string | undefined | null): boolean {
  if (!input || input === '~latest' || isPartialVersion(input)) {
    return false;
  }
  if (!input.startsWith('v') && !/^\d/.test(input)) {
    return false;
  }
  return !!semver.coerce(input);
}

function isSingleVersion(input: string): boolean {
  return isVersion(input);
}

function getMajor(version: string | SemVer): number | null {
  const coerced = semver.coerce(version);
  return coerced ? semver.major(coerced) : null;
}

function getMinor(version: string | SemVer): number | null {
  const coerced = semver.coerce(version);
  return coerced ? semver.minor(coerced) : null;
}

function getPatch(version: string | SemVer): number | null {
  const coerced = semver.coerce(version);
  return coerced ? semver.patch(coerced) : null;
}

function sortVersions(a: string, b: string): number {
  const aCoerced = semver.coerce(a);
  const bCoerced = semver.coerce(b);
  return aCoerced && bCoerced ? semver.compare(aCoerced, bCoerced) : 0;
}

function equals(version: string, other: string): boolean {
  const vCoerced = semver.coerce(version);
  const oCoerced = semver.coerce(other);
  return vCoerced && oCoerced ? semver.eq(vCoerced, oCoerced) : false;
}

function isGreaterThan(version: string, other: string): boolean {
  const vCoerced = semver.coerce(version);
  const oCoerced = semver.coerce(other);
  return vCoerced && oCoerced ? semver.gt(vCoerced, oCoerced) : false;
}

function matches(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  if (range === '~latest') {
    return true;
  }

  const partialMatch = /^v?(\d+)(?:\.(\d+))?$/.exec(range);
  if (partialMatch) {
    const parsed = semver.parse(version);
    if (!parsed || parsed.prerelease.length > 0) {
      return false;
    }

    const major = parseInt(partialMatch[1]);
    const minor = partialMatch[2];

    return minor === undefined
      ? parsed.major === major
      : parsed.major === major && parsed.minor === parseInt(minor);
  }

  const coercedVersion = semver.coerce(version);
  return coercedVersion ? semver.satisfies(coercedVersion, range) : false;
}

function filterMatchingVersions(versions: string[], range: string): string[] {
  if (range === '~latest') {
    return versions
      .map((v) => (semver.valid(v) ? v : semver.coerce(v)?.version))
      .filter(is.string)
      .filter(isStable);
  }

  const partialMatch = /^v?(\d+)(?:\.(\d+))?$/.exec(range);
  if (partialMatch) {
    const major = parseInt(partialMatch[1]);
    const minor = partialMatch[2];

    return versions
      .filter((v) => {
        const parsed = semver.parse(v);
        return parsed && parsed.prerelease.length === 0;
      })
      .map((v) => semver.coerce(v)?.version)
      .filter(is.string)
      .filter((v) => {
        const parsed = semver.parse(v);
        if (!parsed) {
          return false;
        }
        return minor === undefined
          ? parsed.major === major
          : parsed.major === major && parsed.minor === parseInt(minor);
      });
  }

  return versions
    .map((v) => (semver.valid(v) ? v : semver.coerce(v)?.version))
    .filter(is.string);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const filtered = filterMatchingVersions(versions, range);
  return filtered.length === 0
    ? null
    : (semver.maxSatisfying(filtered, '*') ??
        semver.maxSatisfying(filtered, range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const filtered = filterMatchingVersions(versions, range);
  return filtered.length === 0
    ? null
    : (semver.minSatisfying(filtered, '*') ??
        semver.minSatisfying(filtered, range));
}

function isLessThanRange(version: string, range: string): boolean {
  if (range === '~latest') {
    return false;
  }

  const partialMatch = /^v?(\d+)(?:\.(\d+))?$/.exec(range);
  if (partialMatch) {
    const coerced = semver.coerce(version);
    if (!coerced) {
      return false;
    }

    const major = parseInt(partialMatch[1]);
    const minor = partialMatch[2];

    if (minor !== undefined) {
      const minorNum = parseInt(minor);
      return (
        coerced.major < major ||
        (coerced.major === major && coerced.minor < minorNum)
      );
    }
    return coerced.major < major;
  }

  const coercedVersion = semver.coerce(version);
  return coercedVersion ? semver.ltr(coercedVersion, range) : false;
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

    return minor === undefined
      ? `${prefix}${newParsed.major}`
      : `${prefix}${newParsed.major}.${newParsed.minor}`;
  }

  return currentVersion === `v${currentValue}`
    ? newVersion.replace(/^v/, '')
    : newVersion;
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
