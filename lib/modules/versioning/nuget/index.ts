import type { NewValueConfig, VersioningApi } from '../types';
import {
  getFloatingRangeLowerBound,
  parseRange,
  parseVersion,
  rangeToString,
  versionToString,
} from './parser';
import type {
  NugetBracketRange,
  NugetFloatingRange,
  NugetVersion,
} from './types';
import { compare } from './version';

export const id = 'nuget';
export const displayName = 'NuGet';
export const urls = [
  'https://docs.microsoft.com/en-us/nuget/concepts/package-versioning',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'bump'];

class NugetVersioningApi implements VersioningApi {
  isCompatible(version: string, _current?: string | undefined): boolean {
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
    if (!this.isValid(range)) {
      return null;
    }

    let max: string | null = null;
    let maxParsed: NugetVersion | undefined;
    for (const version of versions) {
      if (this.matches(version, range)) {
        const v = parseVersion(version)!;
        if (!maxParsed || compare(v, maxParsed) > 0) {
          max = version;
          maxParsed = v;
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
        if (!minParsed || compare(parsed, minParsed) < 0) {
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

      const prepareResult = (): string => {
        const newRange = rangeToString(res);
        return this.matches(newVersion, newRange) ? newRange : currentValue;
      };

      const prepareComponent = (component: number | undefined): number =>
        component ? Math.floor(component / 10) * 10 : 0;

      if (floating === 'major') {
        res.major = prepareComponent(v.major);
        return prepareResult();
      }
      res.major = v.major;

      if (floating === 'minor') {
        res.minor = prepareComponent(v.minor);
        return prepareResult();
      }
      res.minor = v.minor ?? 0;

      if (floating === 'patch') {
        res.patch = prepareComponent(v.patch);
        return prepareResult();
      }
      res.patch = v.patch ?? 0;

      res.revision = prepareComponent(v.revision);
      return prepareResult();
    }

    const res: NugetBracketRange = { ...r };

    if (!r.max) {
      res.min = v;
      res.minInclusive = true;
      return rangeToString(res);
    }

    if (this.matches(newVersion, currentValue)) {
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

    if (r.type === 'nuget-exact-range') {
      return compare(v, r.version) === 0;
    }

    if (r.type === 'nuget-floating-range') {
      if (!r.prerelease && v.prerelease) {
        return false;
      }

      const lowerBound = getFloatingRangeLowerBound(r);
      return compare(v, lowerBound) >= 0;
    }

    let minBoundMatches = false;
    let maxBoundMatches = false;

    const { min, minInclusive, max, maxInclusive } = r;

    if (min) {
      const minBound =
        min.type === 'nuget-version' ? min : getFloatingRangeLowerBound(min);
      const cmp = compare(v, minBound);
      minBoundMatches = minInclusive ? cmp >= 0 : cmp > 0;
    } else {
      minBoundMatches = true;
    }

    if (max) {
      if (!(v.prerelease && !max.prerelease)) {
        const cmp = compare(v, max);
        maxBoundMatches = maxInclusive ? cmp <= 0 : cmp < 0;
      }
    } else {
      maxBoundMatches = true;
    }

    return minBoundMatches && maxBoundMatches;
  }
}

export const api: VersioningApi = new NugetVersioningApi();

export default api;
