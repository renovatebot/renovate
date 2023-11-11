import { regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import { DistroInfo } from '../distro';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  getDatedContainerImageCodename,
  getDatedContainerImageVersion,
  isDatedCodeName,
} from './common';

export const id = 'ubuntu';
export const displayName = 'Ubuntu';
export const urls = [
  'https://changelogs.ubuntu.com/meta-release',
  'https://debian.pages.debian.net/distro-info-data/ubuntu.csv',
];
export const supportsRanges = false;

const di = new DistroInfo('data/ubuntu-distro-info.json');

// validation

function isValid(input: string): boolean {
  if (
    regEx(/^(0[4-5]|[6-9]|[1-9][0-9])\.[0-9][0-9](\.[0-9]{1,2})?$/).test(input)
  ) {
    return true;
  }

  if (di.isCodename(input)) {
    return true;
  }

  return isDatedCodeName(input);
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
  const ver = di.getVersionByCodename(version);
  if (!isValid(ver)) {
    return false;
  }

  const match = ver.match(regEx(/^\d+.\d+/));

  if (!di.isReleased(coerceString(match?.[0], ver))) {
    return false;
  }

  return regEx(/^\d?[02468]\.04/).test(ver);
}

// digestion of version

function getVersionByCodename(version: string): string {
  const datedImgVersion = getDatedContainerImageCodename(version);
  const getVersion = datedImgVersion ? datedImgVersion : version;
  return di.getVersionByCodename(getVersion);
}

function getMajor(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [major] = ver.split('.');
    return parseInt(major, 10);
  }
  return null;
}

function getMinor(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [, minor] = ver.split('.');
    return parseInt(minor, 10);
  }
  return null;
}

function getPatch(version: string): null | number {
  const ver = getVersionByCodename(version);
  if (isValid(ver)) {
    const [, , patch] = ver.split('.');
    return patch ? parseInt(patch, 10) : null;
  }
  return null;
}

// comparison

function equals(version: string, other: string): boolean {
  const verImage = getDatedContainerImageVersion(version);
  const otherImageVer = getDatedContainerImageVersion(other);
  if (verImage !== otherImageVer) {
    return false;
  }

  const ver = getVersionByCodename(version);
  const otherVer = getVersionByCodename(other);
  return isVersion(ver) && isVersion(otherVer) && ver === otherVer;
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

  const xImageVersion = getDatedContainerImageVersion(version) ?? 0;
  const yImageVersion = getDatedContainerImageVersion(other) ?? 0;
  if (xImageVersion > yImageVersion) {
    return true;
  }
  if (xImageVersion < yImageVersion) {
    return false;
  }

  const xPatch = getPatch(version) ?? 0;
  const yPatch = getPatch(other) ?? 0;
  return xPatch > yPatch;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return versions.find((version) => equals(version, range)) ? range : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return getSatisfyingVersion(versions, range);
}

function getNewValue({ currentValue, newVersion }: NewValueConfig): string {
  if (di.isCodename(currentValue)) {
    return di.getCodenameByVersion(newVersion);
  }
  return di.getVersionByCodename(newVersion);
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
