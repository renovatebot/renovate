import semver from 'semver';
import { regEx } from '../../util/regex';
import * as generic from '../loose/generic';
import type { GenericVersion } from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = false;

const pattern = regEx(/^(\d+(?:\.\d+)*)(-[^+]+)?(\+.*)?$/);

function parse(version: string): GenericVersion {
  const matches = pattern.exec(version);
  if (!matches) {
    return null;
  }
  const [, prefix, prerelease] = matches;
  const release = prefix.split('.').map(Number);
  return { release, prerelease: prerelease || '' };
}

function compareSemVer(version1: string, version2: string): number | null {
  const parsed1 = semver.parse(version1);
  const parsed2 = semver.parse(version2);

  if (!(parsed1 && parsed2)) {
    return null;
  }

  return parsed1.compare(parsed2);
}

function compareLegacy(version1: string, version2: string): number {
  const parsed1 = parse(version1);
  const parsed2 = parse(version2);
  if (!(parsed1 && parsed2)) {
    return 1;
  }

  const length = Math.max(parsed1.release.length, parsed2.release.length);
  for (let i = 0; i < length; i += 1) {
    // 2.1 and 2.1.0 are equivalent
    const part1 = parsed1.release[i] || 0;
    const part2 = parsed2.release[i] || 0;
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // numeric version equals
  const suffixComparison = parsed1.prerelease.localeCompare(parsed2.prerelease);
  if (suffixComparison !== 0) {
    // Empty suffix should compare greater than non-empty suffix
    if (parsed1.prerelease === '') {
      return 1;
    }
    if (parsed2.prerelease === '') {
      return -1;
    }
  }
  return suffixComparison;
}

function compare(version1: string, version2: string): number {
  const res = compareSemVer(version1, version2);
  if (res !== null) {
    return res;
  }

  return compareLegacy(version1, version2);
}

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
};

export default api;
