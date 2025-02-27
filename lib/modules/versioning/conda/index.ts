import { Version, VersionSpec } from '@trim21/rattler';
import type { SemVer } from 'semver';

import type { RangeStrategy } from '../../../types/versioning';
import pep440 from '../pep440';
import type { NewValueConfig, VersioningApi } from '../types';

function parse(v: string): Version | null {
  try {
    return new Version(v);
  } catch {
    return null;
  }
}

export const id = 'conda';
export const displayName = 'conda';
export const urls = [
  'https://docs.conda.io/projects/conda-build/en/stable/resources/package-spec.html#package-match-specifications',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  // TODO we should support more strategy but currently only pin
  'pin',
  'replace',
];

function isValidVersion(s: string): boolean {
  try {
    new Version(s);
    return true;
  } catch {
    return false;
  }
}

function isValidVersionSpec(s: string): boolean {
  try {
    new VersionSpec(s);
    return true;
  } catch {
    return false;
  }
}

function isValid(input: string): boolean {
  return isValidVersion(input) || isValidVersionSpec(input);
}

function matches(version: string, range: string): boolean {
  try {
    return new VersionSpec(range).matches(new Version(version));
  } catch {
    return false;
  }
}

function isSingleVersion(input: string): boolean {
  if (!input.startsWith('=')) {
    return false;
  }

  return isValidVersion(input.replace(/^==/, '').trimStart());
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
  isReplacement,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    if (!currentValue.trim()) {
      return '==' + newVersion;
    }
    // already pin
    if (isSingleVersion(currentValue)) {
      return '==' + newVersion;
    }

    if (matches(newVersion, currentValue)) {
      return '==' + newVersion;
    }

    return null;
  }

  if (rangeStrategy === 'replace') {
    if (currentValue.includes('|') || currentValue.includes(',')) {
      //  conda and/or, can't replace
      return null;
    }

    if (currentVersion) {
      if (
        ['==', '>'].some((item) => currentValue.startsWith(item)) &&
        currentValue.includes(currentVersion)
      ) {
        return currentValue.replace(currentVersion, newVersion);
      }
    }

    return null;
  }

  // TODO: not implement yet.
  return null;
}

function sortVersions(version: string, other: string): number {
  return new Version(version).compare(new Version(other));
}

export const api = {
  isValid,
  isVersion: isValidVersion,
  isSingleVersion,

  // conda doesn't have stable version and non-stable version
  // for example, tzdata has version 2024a but it's stable
  isStable(version: string): boolean {
    return !(parse(version)?.isDev ?? true);
  },

  // conda use version are always compatible with each other.
  isCompatible(version: string, current?: string): boolean {
    return true;
  },

  getMajor(version: string | SemVer): null | number {
    return parse(version as string)?.asMajorMinor?.()?.[0] ?? null;
  },
  getMinor(version: string | SemVer): null | number {
    return parse(version as string)?.asMajorMinor?.()?.[1] ?? null;
  },
  // sadly conda version doesn't have a concept of patch version
  // so we try to use pep440 get a patch version.
  getPatch(version: string | SemVer): null | number {
    try {
      return pep440.getPatch(version);
    } catch {
      return null;
    }
  },
  equals(version: string, other: string): boolean {
    const v2 = parse(other);
    if (!v2) {
      return false;
    }

    return parse(version)?.equals(v2) ?? false;
  },
  isGreaterThan(version: string, other: string): boolean {
    return sortVersions(version, other) > 0;
  },
  getSatisfyingVersion(versions: string[], range: string): string | null {
    const spec = new VersionSpec(range);

    const satisfiedVersions = versions
      .map((v) => {
        return [new Version(v), v] as const;
      })
      .filter(([v, raw]) => spec.matches(v))
      .sort((a, b) => {
        return a[0].compare(b[0]);
      });

    if (satisfiedVersions.length === 0) {
      return null;
    }

    return satisfiedVersions[satisfiedVersions.length - 1][1];
  },

  minSatisfyingVersion(versions: string[], range: string): string | null {
    const spec = new VersionSpec(range);

    const satisfiedVersions = versions
      .map((v) => {
        return [new Version(v), v] as const;
      })
      .filter(([v, raw]) => spec.matches(v))
      .sort((a, b) => {
        return a[0].compare(b[0]);
      });

    if (satisfiedVersions.length === 0) {
      return null;
    }

    return satisfiedVersions[0][1];
  },
  getNewValue,

  matches,
  sortVersions,
} satisfies VersioningApi;

export default api;
