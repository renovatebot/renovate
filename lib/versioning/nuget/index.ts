import * as generic from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = false;

const pattern = /^(\d+(?:\.\d+)*)(-[^+]+)?(\+.*)?$/;

function parse(version: string): any {
  const matches = pattern.exec(version);
  if (!matches) {
    return null;
  }
  const [, prefix, prereleasesuffix] = matches;
  const release = prefix.split('.').map(Number);
  return { release, suffix: prereleasesuffix || '' };
}

function compare(version1: string, version2: string): number {
  const parsed1 = parse(version1);
  const parsed2 = parse(version2);
  // istanbul ignore if
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
  const suffixComparison = parsed1.suffix.localeCompare(parsed2.suffix);
  if (suffixComparison !== 0) {
    // Empty suffix should compare greater than non-empty suffix
    if (parsed1.suffix === '') {
      return 1;
    }
    if (parsed2.suffix === '') {
      return -1;
    }
  }
  return suffixComparison;
}

function isStable(version: string): boolean {
  const parsed = parse(version);
  return parsed && parsed.suffix === '';
}

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isStable,
};

export default api;
