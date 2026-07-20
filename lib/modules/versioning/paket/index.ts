import type { RangeStrategy } from '../../../types/versioning.ts';
import { parseVersion } from '../nuget/parser.ts';
import type { NugetVersion } from '../nuget/types.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import type { PaketConstraint, PaketRange } from './range.ts';
import {
  adaptToPrecision,
  bumpAtPrecision,
  ensurePrereleaseMatches,
  intervalOf,
  isLessThanLowerBound,
  matches as matchesRange,
  parseRange,
  rangeToString,
  releaseParts,
  twiddle,
} from './range.ts';
import { compare, sameReleaseParts } from './version.ts';

export const id = 'paket';
export const displayName = 'Paket';
export const urls = [
  '[Paket version constraints](https://fsprojects.github.io/Paket/nuget-dependencies.html#Version-constraints)',
  '[NuGet package versioning](https://learn.microsoft.com/nuget/concepts/package-versioning)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
  'update-lockfile',
];

function isVersion(input: string | undefined | null): boolean {
  return !!input && parseVersion(input) !== null;
}

function isValid(input: string): boolean {
  return parseRange(input) !== null;
}

function isSingleVersionRange(range: PaketRange): boolean {
  if (range.constraints.length !== 1 || range.prereleaseTags.length > 0) {
    return false;
  }

  const { operator } = range.constraints[0];
  return operator === '' || operator === '=' || operator === '==';
}

function isSingleVersion(input: string): boolean {
  const range = parseRange(input);
  return !!range && isSingleVersionRange(range);
}

function isStable(input: string): boolean {
  const version = parseVersion(input);
  if (version) {
    return !version.prerelease;
  }

  const range = parseRange(input);
  return (
    !!range &&
    isSingleVersionRange(range) &&
    !range.constraints[0].version.prerelease
  );
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

function getMajor(version: string): number | null {
  return parseVersion(version)?.major ?? null;
}

function getMinor(version: string): number | null {
  return parseVersion(version)?.minor ?? null;
}

function getPatch(version: string): number | null {
  return parseVersion(version)?.patch ?? null;
}

function compareVersions(version: string, other: string): number | null {
  const x = parseVersion(version);
  const y = parseVersion(other);
  return x && y ? compare(x, y) : null;
}

function equals(version: string, other: string): boolean {
  return compareVersions(version, other) === 0;
}

function isGreaterThan(version: string, other: string): boolean {
  const cmp = compareVersions(version, other);
  return cmp !== null && cmp > 0;
}

function sortVersions(version: string, other: string): number {
  return compareVersions(version, other) ?? 0;
}

function matches(version: string, range: string): boolean {
  const v = parseVersion(version);
  const r = parseRange(range);
  return !!v && !!r && matchesRange(v, r);
}

function isLessThanRange(version: string, range: string): boolean {
  const v = parseVersion(version);
  const r = parseRange(range);
  return !!v && !!r && isLessThanLowerBound(v, r);
}

function satisfyingVersions(versions: string[], range: string): string[] {
  return versions.filter((v) => matches(v, range)).sort(sortVersions);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersions(versions, range).pop() ?? null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersions(versions, range).shift() ?? null;
}

function getPinnedValue(newVersion: string): string {
  return newVersion;
}

function replaceConstraint(
  constraint: PaketConstraint,
  v: NugetVersion,
): PaketConstraint {
  const { operator, version } = constraint;
  switch (operator) {
    case '':
    case '=':
    case '==':
      return { operator, version: v };
    case '>':
    case '>=':
      return constraint;
    case '<=':
      return compare(v, version) > 0 ? { operator, version: v } : constraint;
    case '<':
      return compare(v, version) >= 0 || sameReleaseParts(v, version)
        ? {
            operator,
            version: bumpAtPrecision(v, releaseParts(version).length),
          }
        : constraint;
    case '~>': {
      const cap = twiddle(version);
      return compare(v, cap) >= 0 || sameReleaseParts(v, cap)
        ? {
            operator,
            version: adaptToPrecision(v, releaseParts(version).length),
          }
        : constraint;
    }
  }
}

/**
 * Rewrite `~> band` optionally followed by a `>=`/`>` floor: the band follows
 * the new version at its old precision, and the floor sticks to the exact new
 * version unless it becomes redundant.
 */
function pessimisticWithFloor(range: PaketRange, v: NugetVersion): PaketRange {
  const [pessimistic] = range.constraints;
  const band = adaptToPrecision(v, releaseParts(pessimistic.version).length);
  const constraints: PaketConstraint[] =
    compare(band, v) === 0
      ? [{ operator: '~>', version: band }]
      : [
          { operator: '~>', version: band },
          { operator: '>=', version: v },
        ];
  return { ...range, constraints };
}

function replaceRange(range: PaketRange, v: NugetVersion): PaketRange {
  const [first, second] = range.constraints;
  if (
    first.operator === '~>' &&
    (second?.operator === '>' || second?.operator === '>=')
  ) {
    return pessimisticWithFloor(range, v);
  }

  return {
    ...range,
    constraints: range.constraints.map((c) => replaceConstraint(c, v)),
  };
}

function bumpConstraint(
  constraint: PaketConstraint,
  v: NugetVersion,
): PaketConstraint {
  const { operator, version } = constraint;
  switch (operator) {
    case '>=':
      return compare(v, version) > 0 ? { operator, version: v } : constraint;
    case '>':
      // the lower bound guard in `getNewValue` ensures `v` is above `version`
      return { operator: '>=', version: v };
    case '~>': {
      const adapted = adaptToPrecision(v, releaseParts(version).length);
      return compare(adapted, version) > 0
        ? { operator, version: adapted }
        : constraint;
    }
    default:
      return replaceConstraint(constraint, v);
  }
}

function bumpRange(range: PaketRange, v: NugetVersion): PaketRange {
  const [first, second] = range.constraints;
  if (
    first.operator === '~>' &&
    second?.operator !== '<' &&
    second?.operator !== '<='
  ) {
    return pessimisticWithFloor(range, v);
  }

  return {
    ...range,
    constraints: range.constraints.map((c) => bumpConstraint(c, v)),
  };
}

function widenRange(range: PaketRange, v: NugetVersion): PaketRange {
  const interval = intervalOf(range.constraints);
  const [first] = range.constraints;

  if (interval.kind !== 'range' || first.operator !== '~>') {
    return {
      ...range,
      constraints: range.constraints.map((c) => replaceConstraint(c, v)),
    };
  }

  const { from, fromInclusive, to, toInclusive } = interval;
  const upperViolated = toInclusive
    ? compare(v, to) > 0
    : compare(v, to) >= 0 || sameReleaseParts(v, to);
  if (!upperViolated) {
    return range;
  }

  // The pessimistic operator acts as both bounds, so decompose it into
  // explicit bounds to widen upwards while keeping the lower bound.
  const lower: PaketConstraint = {
    operator: fromInclusive ? '>=' : '>',
    version: from,
  };
  const upper: PaketConstraint = toInclusive
    ? { operator: '<=', version: v }
    : { operator: '<', version: bumpAtPrecision(v, releaseParts(to).length) };
  return { ...range, constraints: [lower, upper] };
}

function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string | null {
  const v = parseVersion(newVersion);
  if (!v) {
    return null;
  }

  if (isVersion(currentValue)) {
    return newVersion;
  }

  const range = parseRange(currentValue);
  if (!range) {
    return null;
  }

  if (rangeStrategy === 'pin') {
    return `${range.strategy ?? ''}${newVersion}`;
  }

  if (isLessThanLowerBound(v, range)) {
    return currentValue;
  }

  let result: PaketRange;
  if (rangeStrategy === 'bump') {
    result = bumpRange(range, v);
  } else if (matchesRange(v, range)) {
    return currentValue;
  } else if (rangeStrategy === 'widen') {
    result = widenRange(range, v);
  } else {
    result = replaceRange(range, v);
  }

  const newValue = rangeToString(ensurePrereleaseMatches(result, v));
  return newValue === rangeToString(range) ? currentValue : newValue;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  getNewValue,
  getPinnedValue,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  sortVersions,
};

export default api;
