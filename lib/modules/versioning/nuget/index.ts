import type { NewValueConfig, VersioningApi } from '../types';
import { parseRange, parseVersion } from './parser';
import {
  coerceFloatingComponent,
  getFloatingRangeLowerBound,
  matches,
  rangeToString,
  tryBump,
} from './range';
import type {
  NugetBracketRange,
  NugetFloatingRange,
  NugetVersion,
} from './types';
import { compare, versionToString } from './version';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
  'https://nugettools.azurewebsites.net/',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'bump'];

class NugetVersioningApi implements VersioningApi {
  isCompatible(version: string, _current?: string): boolean {
    return this.isValid(version);
  }

  isSingleVersion(version: string): boolean {
    const r = parseRange(version);
    if (!r) {
      return false;
    }

    return r.type === 'nuget-exact-range';
  }

  isStable(version: string): boolean {
    const v = parseVersion(version);
    if (v) {
      return !v.prerelease;
    }

    const r = parseRange(version);
    if (!r || r.type !== 'nuget-exact-range') {
      return false;
    }

    return !r.version.prerelease;
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

    if (r.type === 'nuget-exact-range') {
      return compare(v, r.version) < 0;
    }

    if (r.type === 'nuget-bracket-range') {
      if (!r.min) {
        return false;
      }

      const minBound =
        r.min.type === 'nuget-version'
          ? r.min
          : getFloatingRangeLowerBound(r.min);
      const cmp = compare(v, minBound);
      return r.minInclusive ? cmp < 0 : cmp <= 0;
    }

    const minBound = getFloatingRangeLowerBound(r);
    return compare(v, minBound) < 0;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    const r = parseRange(range);
    if (r) {
      let result: string | null = null;
      let vMax: NugetVersion | undefined;
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
      let vMax: NugetVersion | undefined;
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
      let vMin: NugetVersion | undefined;
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
      let vMin: NugetVersion | undefined;
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
      return rangeToString({ type: 'nuget-exact-range', version: v });
    }

    if (this.isVersion(currentValue)) {
      return newVersion;
    }

    const r = parseRange(currentValue);
    if (!r) {
      return null;
    }

    if (this.isLessThanRange(newVersion, currentValue)) {
      return currentValue;
    }

    if (r.type === 'nuget-exact-range') {
      return rangeToString({ type: 'nuget-exact-range', version: v });
    }

    if (r.type === 'nuget-floating-range') {
      const floating = r.floating;
      if (!floating) {
        return versionToString(v);
      }

      const res: NugetFloatingRange = { ...r };

      if (floating === 'major') {
        res.major = coerceFloatingComponent(v.major);
        return tryBump(res, v, currentValue);
      }
      res.major = v.major;

      if (floating === 'minor') {
        res.minor = coerceFloatingComponent(v.minor);
        return tryBump(res, v, currentValue);
      }
      res.minor = v.minor ?? 0;

      if (floating === 'patch') {
        res.patch = coerceFloatingComponent(v.patch);
        return tryBump(res, v, currentValue);
      }
      res.patch = v.patch ?? 0;

      res.revision = coerceFloatingComponent(v.revision);
      return tryBump(res, v, currentValue);
    }

    const res: NugetBracketRange = { ...r };

    if (!r.max) {
      res.min = v;
      res.minInclusive = true;
      return rangeToString(res);
    }

    if (matches(v, r)) {
      return currentValue;
    }

    if (!r.min) {
      res.max = v;
      res.maxInclusive = true;
      return rangeToString(res);
    }

    res.max = v;
    res.maxInclusive = true;
    return rangeToString(res);
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

    const u = parseVersion(range);
    if (u) {
      return compare(v, u) >= 0;
    }

    const r = parseRange(range);
    if (!r) {
      return false;
    }

    return matches(v, r);
  }
}

export const api: VersioningApi = new NugetVersioningApi();

export default api;
