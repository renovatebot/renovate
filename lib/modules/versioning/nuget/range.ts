import type { NugetFloatingRange, NugetRange, NugetVersion } from './types';
import { compare, versionToString } from './version';

export function getFloatingRangeLowerBound(
  range: NugetFloatingRange,
): NugetVersion {
  const { major, minor = 0, patch = 0, revision = 0, prerelease } = range;
  const res: NugetVersion = {
    type: 'nuget-version',
    major,
    minor,
    patch,
    revision,
  };

  if (prerelease) {
    const parts = prerelease.split('.');
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (last === '*') {
      parts[lastIdx] = '0';
    } else {
      parts[lastIdx] = last.replace(/\*$/, '');
    }
    res.prerelease = parts.join('.');
  }

  return res;
}

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
    if (!(v.prerelease && !max.prerelease)) {
      const cmp = compare(v, max);
      maxBoundMatches = maxInclusive ? cmp <= 0 : cmp < 0;
    }
  } else {
    maxBoundMatches = true;
  }

  return minBoundMatches && maxBoundMatches;
}

function floatingComponentToString(component: number): string {
  const int = component / 10;
  return int === 0 ? '*' : `${int}*`;
}

export function coerceFloatingComponent(component: number | undefined): number {
  return component ? Math.floor(component / 10) * 10 : 0;
}

export function rangeToString(range: NugetRange): string {
  if (range.type === 'nuget-exact-range') {
    return `[${versionToString(range.version)}]`;
  }

  if (range.type === 'nuget-floating-range') {
    const { major, minor, patch, revision, floating, prerelease } = range;
    let res = '';

    if (prerelease) {
      res = `-${prerelease}`;
    }

    if (revision !== undefined) {
      const revisionPart =
        floating === 'revision'
          ? floatingComponentToString(revision)
          : `${revision}`;
      res = `.${revisionPart}${res}`;
    }

    if (patch !== undefined) {
      const patchPart =
        floating === 'patch' ? floatingComponentToString(patch) : `${patch}`;
      res = `.${patchPart}${res}`;
    }

    if (minor !== undefined) {
      const minorPart =
        floating === 'minor' ? floatingComponentToString(minor) : `${minor}`;
      res = `.${minorPart}${res}`;
    }

    if (major !== undefined) {
      const majorPart =
        floating === 'major' ? floatingComponentToString(major) : `${major}`;
      res = `${majorPart}${res}`;
    }

    return res;
  }

  const { min, max, minInclusive, maxInclusive } = range;
  const leftBracket = minInclusive ? '[' : '(';
  const rightBracket = maxInclusive ? ']' : ')';
  if (min && max) {
    const minStr =
      min.type === 'nuget-version' ? versionToString(min) : rangeToString(min);
    const maxStr = versionToString(max);
    return `${leftBracket}${minStr},${maxStr}${rightBracket}`;
  }

  if (min) {
    const minStr =
      min.type === 'nuget-version' ? versionToString(min) : rangeToString(min);
    return `${leftBracket}${minStr},${rightBracket}`;
  }

  const maxStr = versionToString(max);
  return `${leftBracket},${maxStr}${rightBracket}`;
}

export function tryBump(r: NugetRange, v: NugetVersion, x: string): string {
  return matches(v, r) ? rangeToString(r) : x;
}
