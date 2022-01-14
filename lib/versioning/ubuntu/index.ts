import { regEx } from '../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'ubuntu';
export const displayName = 'Ubuntu';
export const urls = ['https://changelogs.ubuntu.com/meta-release'];
export const supportsRanges = false;

// #12509
const temporarilyUnstable = ['22.04'];

// validation

function isValid(input: string): boolean {
  return (
    typeof input === 'string' &&
    regEx(/^(0[4-5]|[6-9]|[1-9][0-9])\.[0-9][0-9](\.[0-9]{1,2})?$/).test(input)
  );
}

function isVersion(input: string): boolean {
  return isValid(input);
}

function isCompatible(version: string, _current?: string): boolean {
  return isValid(version);
}

function isSingleVersion(version: string): boolean {
  return isValid(version);
}

function isStable(version: string): boolean {
  if (!isValid(version)) {
    return false;
  }
  if (temporarilyUnstable.includes(version)) {
    return false;
  }
  return regEx(/^\d?[02468]\.04/).test(version);
}

// digestion of version

function getMajor(version: string): null | number {
  if (isValid(version)) {
    const [major] = version.split('.') || [];
    return parseInt(major, 10);
  }
  return null;
}

function getMinor(version: string): null | number {
  if (isValid(version)) {
    const [, minor] = version.split('.') || [];
    return parseInt(minor, 10);
  }
  return null;
}

function getPatch(version: string): null | number {
  if (isValid(version)) {
    const [, , patch] = version.split('.') || [];
    return patch ? parseInt(patch, 10) : null;
  }
  return null;
}

// comparison

function equals(version: string, other: string): boolean {
  return isVersion(version) && isVersion(other) && version === other;
}

function isGreaterThan(version: string, other: string): boolean {
  const xMajor = getMajor(version) ?? 0;
  const yMajor = getMajor(other) ?? 0;
  if (xMajor > yMajor) {
    return true;
  }
  if (xMajor < yMajor) {
    return false;
  }

  const xMinor = getMinor(version) ?? 0;
  const yMinor = getMinor(other) ?? 0;
  if (xMinor > yMinor) {
    return true;
  }
  if (xMinor < yMinor) {
    return false;
  }

  const xPatch = getPatch(version) ?? 0;
  const yPatch = getPatch(other) ?? 0;
  return xPatch > yPatch;
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return versions.find((version) => equals(version, range)) ? range : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return getSatisfyingVersion(versions, range);
}

function getNewValue(newValueConfig: NewValueConfig): string {
  return newValueConfig.newVersion;
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
  isCompatible,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,

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
