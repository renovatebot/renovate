import type { NewValueConfig, VersioningApi } from '../types';
import { parseRange, parseVersion } from './parser';
import { getFloatingRangeLowerBound, matches, tryBump } from './range';
import type { DotnetSdkFloatingRange, DotnetSdkVersion } from './types';
import { compare, versionToString } from './version';

export const id = 'dotnet-sdk';
export const displayName = '.NET SDK';
export const urls = ['https://learn.microsoft.com/dotnet/core/versions/'];
export const supportsRanges = false;
export const supportedRangeStrategies = ['pin', 'bump'];

class DotnetSdkVersioningApi implements VersioningApi {
  isCompatible(version: string, _current?: string): boolean {
    return this.isValid(version);
  }

  isSingleVersion(version: string): boolean {
    const r = parseRange(version);
    if (!r) {
      return parseVersion(version) !== null;
    }

    return r.type !== 'dotnet-sdk-floating-range';
  }

  isStable(version: string): boolean {
    const v = parseVersion(version);
    if (v) {
      return !v.prerelease;
    }

    const r = parseRange(version);
    if (!r) {
      return false;
    }

    return !r.prerelease;
  }

  isValid(input: string): boolean {
    const v = parseVersion(input);
    if (v) {
      return true;
    }

    const r = parseRange(input);
    if (r) {
      return true;
    }

    return false;
  }

  isVersion(input: string | undefined | null): boolean {
    if (!input) {
      return false;
    }

    const v = parseVersion(input);
    if (!v) {
      return false;
    }

    return true;
  }

  getMajor(version: string): number | null {
    const v = parseVersion(version);
    if (!v) {
      return null;
    }

    return v.major;
  }

  getMinor(version: string): number | null {
    const v = parseVersion(version);
    if (!v) {
      return null;
    }

    return v.minor ?? null;
  }

  getPatch(version: string): number | null {
    const v = parseVersion(version);
    if (!v) {
      return null;
    }

    return v.patch ?? null;
  }

  equals(version: string, other: string): boolean {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return false;
    }

    return compare(x, y) === 0;
  }

  isGreaterThan(version: string, other: string): boolean {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return false;
    }

    return compare(x, y) > 0;
  }

  isLessThanRange(version: string, range: string): boolean {
    const v = parseVersion(version);
    if (!v) {
      return false;
    }

    const u = parseVersion(range);
    if (u) {
      return compare(v, u) < 0;
    }

    const r = parseRange(range);
    if (!r) {
      return false;
    }

    const minBound = getFloatingRangeLowerBound(r);
    return compare(v, minBound) < 0;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    const r = parseRange(range);
    if (r) {
      let result: string | null = null;
      let vMax: DotnetSdkVersion | undefined;
      for (const version of versions) {
        const v = parseVersion(version);
        if (!v) {
          continue;
        }

        if (!matches(v, r)) {
          continue;
        }

        if (!vMax || compare(v, vMax) > 0) {
          vMax = v;
          result = version;
        }
      }

      return result;
    }

    const u = parseVersion(range);
    if (u) {
      let result: string | null = null;
      let vMax: DotnetSdkVersion | undefined;
      for (const version of versions) {
        const v = parseVersion(version);
        if (!v) {
          continue;
        }

        if (compare(v, u) < 0) {
          continue;
        }

        if (!vMax || compare(v, vMax) > 0) {
          vMax = v;
          result = version;
        }
      }

      return result;
    }

    return null;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    const r = parseRange(range);
    if (r) {
      let result: string | null = null;
      let vMin: DotnetSdkVersion | undefined;
      for (const version of versions) {
        const v = parseVersion(version);
        if (!v) {
          continue;
        }

        if (!matches(v, r)) {
          continue;
        }

        if (!vMin || compare(v, vMin) < 0) {
          result = version;
          vMin = v;
        }
      }

      return result;
    }

    const u = parseVersion(range);
    if (u) {
      let result: string | null = null;
      let vMin: DotnetSdkVersion | undefined;
      for (const version of versions) {
        const v = parseVersion(version);
        if (!v) {
          continue;
        }

        if (compare(v, u) < 0) {
          continue;
        }

        if (!vMin || compare(v, vMin) < 0) {
          result = version;
          vMin = v;
        }
      }

      return result;
    }

    return null;
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
      return versionToString(v);
    }

    const r = parseRange(currentValue);
    if (!r) {
      if (this.isVersion(currentValue)) {
        return newVersion;
      }
      return null;
    }

    if (this.isLessThanRange(newVersion, currentValue)) {
      return currentValue;
    }

    const floating = r.floating;
    if (!floating) {
      return versionToString(v);
    }

    const res: DotnetSdkFloatingRange = { ...r };

    if (floating === 'major') {
      res.major = v.major;
      return tryBump(res, v, currentValue);
    }
    res.major = v.major;

    if (floating === 'minor') {
      res.minor = v.minor;
      return tryBump(res, v, currentValue);
    }
    res.minor = v.minor ?? 0;

    if (floating === 'patch') {
      res.patch = v.patch;
      return tryBump(res, v, currentValue);
    }

    res.patch = v.patch ?? 100;
    if (v.prerelease) {
      res.prerelease = v.prerelease;
    }

    return tryBump(res, v, currentValue);
  }

  sortVersions(version: string, other: string): number {
    const x = parseVersion(version);
    const y = parseVersion(other);
    if (!x || !y) {
      return 0;
    }

    return compare(x, y);
  }

  matches(version: string, range: string): boolean {
    const v = parseVersion(version);
    if (!v) {
      return false;
    }

    const r = parseRange(range);
    if (!r) {
      const u = parseVersion(range);
      if (!u) {
        return false;
      }
      return compare(v, u) >= 0;
    }

    return matches(v, r);
  }
}

export const api: VersioningApi = new DotnetSdkVersioningApi();

export default api;
