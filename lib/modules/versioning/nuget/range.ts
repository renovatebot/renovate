import { getFloatingRangeLowerBound, parseRange, parseVersion } from './parser';
import { compare } from './version';

export function matches(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) {
    return false;
  }

  const u = parseVersion(range);
  if (u) {
    return compare(v, u) === 0;
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
    const cmp = compare(v, max);
    maxBoundMatches = maxInclusive ? cmp <= 0 : cmp < 0;
  } else {
    maxBoundMatches = true;
  }

  return minBoundMatches && maxBoundMatches;
}
