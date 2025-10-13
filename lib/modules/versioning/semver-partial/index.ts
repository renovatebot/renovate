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
  if (!coerced) {
    return false;
  }
  return stable.is(coerced.version);
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
  if (!coerced) {
    return null;
  }
  return semver.major(coerced);
}

function getMinor(version: string | SemVer): number | null {
  const coerced = semver.coerce(version);
  if (!coerced) {
    return null;
  }
  return semver.minor(coerced);
}

function getPatch(version: string | SemVer): number | null {
  const coerced = semver.coerce(version);
  if (!coerced) {
    return null;
  }
  return semver.patch(coerced);
}

function sortVersions(a: string, b: string): number {
  const aCoerced = semver.coerce(a);
  const bCoerced = semver.coerce(b);
  if (!aCoerced || !bCoerced) {
    return 0;
  }
  return semver.compare(aCoerced, bCoerced);
}

function equals(version: string, other: string): boolean {
  const vCoerced = semver.coerce(version);
  const oCoerced = semver.coerce(other);
  if (!vCoerced || !oCoerced) {
    return false;
  }
  return semver.eq(vCoerced, oCoerced);
}

function isGreaterThan(version: string, other: string): boolean {
  const vCoerced = semver.coerce(version);
  const oCoerced = semver.coerce(other);
  if (!vCoerced || !oCoerced) {
    return false;
  }
  return semver.gt(vCoerced, oCoerced);
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

    if (minor === undefined) {
      return parsed.major === major;
    }
    return parsed.major === major && parsed.minor === parseInt(minor);
  }

  const coercedVersion = semver.coerce(version);
  if (!coercedVersion) {
    return false;
  }
  return semver.satisfies(coercedVersion, range);
}

function filterMatchingVersions(versions: string[], range: string): string[] {
  if (range === '~latest') {
    return versions
      .map((v) => {
        if (semver.valid(v)) {
          return v;
        }
        return semver.coerce(v)?.version;
      })
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
        if (minor === undefined) {
          return parsed.major === major;
        }
        return parsed.major === major && parsed.minor === parseInt(minor);
      });
  }

  return versions
    .map((v) => {
      if (semver.valid(v)) {
        return v;
      }
      return semver.coerce(v)?.version;
    })
    .filter(is.string);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const filtered = filterMatchingVersions(versions, range);
  if (filtered.length === 0) {
    return null;
  }
  return (
    semver.maxSatisfying(filtered, '*') ?? semver.maxSatisfying(filtered, range)
  );
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const filtered = filterMatchingVersions(versions, range);
  if (filtered.length === 0) {
    return null;
  }
  return (
    semver.minSatisfying(filtered, '*') ?? semver.minSatisfying(filtered, range)
  );
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
  if (!coercedVersion) {
    return false;
  }
  return semver.ltr(coercedVersion, range);
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
