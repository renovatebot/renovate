import type { SemVer } from 'semver';
import type { RangeStrategy } from '../../../types';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'rust-toolchain';
export const displayName = 'Rust Toolchain';
export const urls = [
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file',
];
export const supportsRanges = false;
export const supportedRangeStrategies: RangeStrategy[] = ['replace'];

const versionPattern = regEx(/^(\d+).(\d+).(\d+)$/);

function isValid(input: string): boolean {
  return versionPattern.test(input);
}

function isVersion(input: string | undefined | null): boolean {
  return input ? isValid(input) : false;
}

function isSingleVersion(input: string): boolean {
  return isValid(input);
}

function isStable(version: string): boolean {
  const major = getMajor(version);
  return Boolean(major);
}

function isCompatible(version: string): boolean {
  return isValid(version);
}

function getMajor(version: string | SemVer): null | number {
  const match = versionPattern.exec(version.toString());
  return match ? parseInt(match[1]) : null;
}

function getMinor(version: string | SemVer): null | number {
  const match = versionPattern.exec(version.toString());
  return match ? parseInt(match[2]) : null;
}

function getPatch(version: string | SemVer): null | number {
  const match = versionPattern.exec(version.toString());
  return match ? parseInt(match[3]) : null;
}

function equals(version: string, other: string): boolean {
  return version === other;
}

function isGreaterThan(version: string, other: string): boolean {
  return sortVersions(version, other) === 1;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return versions.includes(range) ? range : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return versions.includes(range) ? range : null;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  if (rangeStrategy !== 'replace') {
    return null;
  }

  if (!isValid(currentValue)) {
    return null;
  }

  if (equals(newVersion, currentValue)) {
    return null;
  }

  return newVersion;
}

function sortVersions(version: string, other: string): number {
  const aMatch = versionPattern.exec(version);
  const bMatch = versionPattern.exec(other);
  if (aMatch === null) {
    return bMatch === null ? 0 : -1;
  } else if (bMatch === null) {
    return 1;
  }

  const aMajor = parseInt(aMatch[1]);
  const bMajor = parseInt(bMatch[1]);
  if (aMajor > bMajor) {
    return 1;
  }
  if (aMajor < bMajor) {
    return -1;
  }

  const aMinor = parseInt(aMatch[2]);
  const bMinor = parseInt(bMatch[2]);
  if (aMinor > bMinor) {
    return 1;
  }
  if (aMinor < bMinor) {
    return -1;
  }

  const aPatch = parseInt(aMatch[3]);
  const bPatch = parseInt(bMatch[3]);
  if (aPatch > bPatch) {
    return 1;
  }
  if (aPatch < bPatch) {
    return -1;
  }

  return 0;
}

function matches(version: string, range: string): boolean {
  return version === range;
}

export const api: VersioningApi = {
  isValid,
  isVersion,
  isSingleVersion,
  isStable,
  isCompatible,
  getMajor,
  getMinor,
  getPatch,
  equals,
  isGreaterThan,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
  matches,
};

export default api;
