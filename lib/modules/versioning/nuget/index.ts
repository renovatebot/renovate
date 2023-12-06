import type { NewValueConfig, VersioningApi } from '../types';
import { cmp } from './compare';
import { parseRange, parseVersion } from './parse';
import type { NugetVersion } from './types';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = false;

class NugetVersioningApi implements VersioningApi {
  isCompatible(version: string, current?: string | undefined): boolean {
    return true;
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

    return parsed.minor;
  }

  getPatch(version: string): number | null {
    const parsed = parseVersion(version);
    if (!parsed) {
      return null;
    }

    return parsed.patch;
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
      if (r.type === 'range-exact') {
        return cmp(v, r.version) === 0;
      }

      if (r.type === 'range-min') {
        if (r.minInclusive) {
          return cmp(v, r.min) >= 0;
        }

        return cmp(v, r.min) > 0;
      }

      if (r.type === 'range-max') {
        if (r.maxInclusive) {
          return cmp(v, r.max) <= 0;
        }

        return cmp(v, r.max) < 0;
      }

      if (r.type === 'range-mixed') {
        if (r.minInclusive) {
          if (r.maxInclusive) {
            return cmp(v, r.min) >= 0 && cmp(v, r.max) <= 0;
          }

          return cmp(v, r.min) >= 0 && cmp(v, r.max) < 0;
        }

        if (r.maxInclusive) {
          return cmp(v, r.min) > 0 && cmp(v, r.max) <= 0;
        }

        return cmp(v, r.min) > 0 && cmp(v, r.max) < 0;
      }

      if (r.type === 'floating-major') {
        return r.unstable || !v.prerelease;
      }

      if (r.type === 'floating-minor') {
        return r.major === v.major && (r.unstable || !v.prerelease);
      }

      if (r.type === 'floating-patch') {
        return (
          r.major === v.major &&
          r.minor === v.minor &&
          (r.unstable || !v.prerelease)
        );
      }

      if (r.type === 'floating-revision') {
        return (
          r.major === v.major &&
          r.minor === v.minor &&
          r.patch === v.patch &&
          (r.unstable || !v.prerelease)
        );
      }
    }

    return false;
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
        const parsed = parseVersion(version);
        if (!parsed) {
          continue;
        }

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
        const parsed = parseVersion(version);
        if (!parsed) {
          continue;
        }

        if (!minParsed || cmp(parsed, minParsed) < 0) {
          min = version;
          minParsed = parsed;
        }
      }
    }

    return min;
  }

  sortVersions(version: string, other: string): number {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return 0;
    }

    return cmp(x, y);
  }

  getNewValue({ newVersion }: NewValueConfig): string | null {
    return newVersion ?? null;
  }
}

export const api: VersioningApi = new NugetVersioningApi();

export default api;
