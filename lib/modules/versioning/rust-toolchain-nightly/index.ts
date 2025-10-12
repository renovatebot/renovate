import type { RangeStrategy } from '../../../types';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'rust-toolchain-nightly';
export const displayName = 'Rust Toolchain Nightly';
export const urls = [
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file',
];
export const supportsRanges = false;
export const supportedRangeStrategies: RangeStrategy[] = ['replace'];

const versionPattern = regEx(/^nightly-\d{4}-\d{2}-\d{2}$/);

function isValid(input: string): boolean {
  return versionPattern.test(input);
}

function isVersion(input: string): boolean {
  return isValid(input);
}

function isSingleVersion(version: string): boolean {
  return isValid(version);
}

function isStable(_version: string): boolean {
  // All nightly versions are unstable
  return false;
}

function isCompatible(_version: string, _current?: string): boolean {
  // All nightly versions are "compatible" with each other
  return true;
}

function isBreaking(_current: string, _version: string): boolean {
  // All nightly versions are considered breaking change releases
  return true;
}

function getMajor(_version: string): number | null {
  // This causes branches to be named `renovate/rust-nightly-0.x`, but
  // without returning anything from this function, we don't get any
  // updates for nightly releases.
  //
  // We could instead use the year part of the nightly version, but then
  // we apparently don't get any updates for e.g. 2024 -> 2025.
  return 0;
}

function getMinor(_version: string): number | null {
  // The minor version part appears to be irrelevant regarding the
  // update behavior, so we just return `null` here.
  return null;
}

function getPatch(_version: string): number | null {
  // The patch version part appears to be irrelevant regarding the
  // update behavior, so we just return `null` here.
  return null;
}

function equals(version: string, other: string): boolean {
  return version === other;
}

function isGreaterThan(version: string, other: string): boolean {
  if (!isValid(version) || !isValid(other)) {
    return false;
  }

  return version > other;
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
  return getSatisfyingVersion(versions, range);
}

function getNewValue({ newVersion }: NewValueConfig): string {
  return newVersion;
}

function sortVersions(version: string, other: string): number {
  if (equals(version, other)) {
    return 0;
  }
  if (isGreaterThan(version, other)) {
    return 1;
  }
  return -1;
}

function matches(version: string, range: string): boolean {
  return equals(version, range);
}

export const api: VersioningApi = {
  isValid,
  isVersion,
  isSingleVersion,
  isStable,
  isCompatible,
  isBreaking,

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

  allowUnstableMajorUpgrades: true,
};

export default api;
