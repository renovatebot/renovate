import { getFloatingRangeLowerBound, rangeToString } from './parser';
import type { NugetRange, NugetVersion } from './types';
import { compare } from './version';

export function matches(v: NugetVersion, r: NugetRange): boolean {
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
    const cmp = compare(v, max);
    maxBoundMatches = maxInclusive ? cmp <= 0 : cmp < 0;
  } else {
    maxBoundMatches = true;
  }

  return minBoundMatches && maxBoundMatches;
}

export function pin(version: NugetVersion): string {
  return rangeToString({ type: 'nuget-exact-range', version });
}

export function replace(range: NugetRange, newVersion: NugetVersion): string {
  if (range.type === 'nuget-exact-range') {
    return pin(newVersion);
  }

  return '';
}
