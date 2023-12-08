import type { NewValueConfig, VersioningApi } from '../types';
import { cmp } from './compare';
import { parseRange, parseVersion } from './parse';
import * as nugetRange from './range';
import type { NugetVersion } from './types';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'replace'];

class NugetVersioningApi implements VersioningApi {
  isCompatible(version: string, _current?: string | undefined): boolean {
    return this.isValid(version);
  }

  isSingleVersion(version: string): boolean {
    const parsed = parseRange(version);
    return !!parsed && parsed.type === 'range-exact';
  }

  isStable(version: string): boolean {
    const parsedVersion = parseVersion(version);
    if (parsedVersion) {
      return !parsedVersion.prerelease;
    }

    const parsedRange = parseRange(version);
    if (parsedRange?.type === 'range-exact') {
      return !parsedRange.version.prerelease;
    }

    return false;
  }

  isValid(input: string): boolean {
    return !!parseVersion(input) || !!parseRange(input);
  }

  isVersion(input: string | undefined | null): boolean {
    return input ? !!parseVersion(input) : false;
  }

  getMajor(version: string): number | null {
    const parsed = parseVersion(version);
    if (!parsed) {
      return null;
    }

    return parsed.major;
  }

  getMinor(version: string): number | null {
    const parsed = parseVersion(version);
    if (!parsed) {
      return null;
    }

    return parsed.minor ?? null;
  }

  getPatch(version: string): number | null {
    const parsed = parseVersion(version);
    if (!parsed) {
      return null;
    }

    return parsed.patch ?? null;
  }

  equals(version: string, other: string): boolean {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return false;
    }

    return cmp(x, y) === 0;
  }

  isGreaterThan(version: string, other: string): boolean {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return false;
    }

    return cmp(x, y) > 0;
  }

  isLessThanRange(version: string, range: string): boolean {
    if (this.isVersion(range)) {
      return this.isGreaterThan(range, version);
    }

    const v = parseVersion(version);
    if (!v) {
      return false;
    }

    const r = parseRange(range);
    if (!r || r.type === 'range-max' || r.type === 'floating-major') {
      return false;
    }

    if (r.type === 'range-exact') {
      return cmp(v, r.version) < 0;
    }

    if (r.type === 'range-min' || r.type === 'range-mixed') {
      if (r.minInclusive) {
        return cmp(v, r.min) < 0;
      }

      return cmp(v, r.min) <= 0;
    }

    const u: NugetVersion = {
      major: 0,
      minor: 0,
      patch: 0,
      revision: 0,
      prerelease: undefined,
      metadata: undefined,
    };
    if (r.type === 'floating-minor') {
      u.major = r.major;
    } else if (r.type === 'floating-patch') {
      u.major = r.major;
      u.minor = r.minor;
    } else {
      u.major = r.major;
      u.minor = r.minor;
      u.patch = r.patch;
    }

    const res = cmp({ ...v, prerelease: undefined }, u);

    if (res < 0) {
      return true;
    }

    if (res > 0) {
      return false;
    }

    if (r.unstable) {
      return false;
    }

    return !!v.prerelease;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    const parsedRange = parseRange(range);
    if (!parsedRange) {
      return null;
    }

    let max: string | null = null;
    let maxParsed: NugetVersion | undefined;
    for (const version of versions) {
      if (this.matches(version, range)) {
        const parsed = parseVersion(version)!;
        if (!maxParsed || cmp(parsed, maxParsed) > 0) {
          max = version;
          maxParsed = parsed;
        }
      }
    }

    return max;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    const parsedRange = parseRange(range);
    if (!parsedRange) {
      return null;
    }

    let min: string | null = null;
    let minParsed: NugetVersion | undefined;
    for (const version of versions) {
      if (this.matches(version, range)) {
        const parsed = parseVersion(version)!;
        if (!minParsed || cmp(parsed, minParsed) < 0) {
          min = version;
          minParsed = parsed;
        }
      }
    }

    return min;
  }

  getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  }: NewValueConfig): string | null {
    const v = parseVersion(newVersion);
    if (!v) {
      return null;
    }

    if (rangeStrategy === 'pin') {
      return nugetRange.pin(v);
    }

    if (this.isVersion(currentValue)) {
      return newVersion;
    }

    const r = parseRange(currentValue);
    if (!r) {
      return null;
    }

    return nugetRange.replace(r, v);
  }

  sortVersions(version: string, other: string): number {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return 0;
    }

    return cmp(x, y);
  }

  matches(version: string, range: string): boolean {
    const v = parseVersion(version);
    if (!v) {
      return false;
    }

    const u = parseVersion(range);
    if (u) {
      return cmp(v, u) === 0;
    }

    const r = parseRange(range);
    if (r) {
      return nugetRange.matches(v, r);
    }

    return false;
  }
}

export const api: VersioningApi = new NugetVersioningApi();

export default api;
