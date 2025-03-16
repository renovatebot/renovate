import { Version, VersionSpec } from '@baszalmstra/rattler';
import type { SemVer } from 'semver';

import type { RangeStrategy } from '../../../types/versioning';
import * as pep440 from '../pep440';
import type { NewValueConfig, VersioningApi } from '../types';

function parse(v: string): Version | null {
  try {
    return new Version(v);
  } catch {
    return null;
  }
}

export const id = 'conda';
export const displayName = 'conda';
export const urls = [
  'https://docs.conda.io/projects/conda-build/en/stable/resources/package-spec.html#package-match-specifications',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

function isValidVersion(s: string): boolean {
  try {
    new Version(s);
    return true;
  } catch {
    return false;
  }
}

function isValidVersionSpec(s: string): boolean {
  try {
    new VersionSpec(s);
    return true;
  } catch {
    return false;
  }
}

function isValid(input: string): boolean {
  return isValidVersion(input) || isValidVersionSpec(input);
}

function matches(version: string, range: string): boolean {
  try {
    return new VersionSpec(range).matches(new Version(version));
  } catch {
    return false;
  }
}

function isSingleVersion(input: string): boolean {
  if (!input.startsWith('=')) {
    return false;
  }

  return isValidVersion(input.replace(/^==/, '').trimStart());
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
  isReplacement,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    return '==' + newVersion;
  }

  if (currentValue === '*') {
    if (rangeStrategy === 'bump') {
      return '>=' + newVersion;
    }

    // don't think you can widen or replace `*`
    return null;
  }

  const normalizedCurrentValue = new VersionSpec(currentValue).toString();

  // it's valid range spec in conda to write `3.12.*`, translate to pep440 `==3.12.*`
  if (/^(\d+\.)+\*$/.test(normalizedCurrentValue)) {
    const newValue = pep440.api.getNewValue({
      currentValue: '==' + normalizedCurrentValue,
      rangeStrategy,
      currentVersion,
      newVersion,
      isReplacement,
    });

    return newValue?.replace(/^==/, '') ?? null;
  }

  return pep440.api.getNewValue({
    currentValue: normalizedCurrentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
    isReplacement,
  });
}

function sortVersions(version: string, other: string): number {
  return new Version(version).compare(new Version(other));
}

function equals(version: string, other: string): boolean {
  const v2 = parse(other);
  if (!v2) {
    return false;
  }

  return parse(version)?.equals(v2) ?? false;
}

function isStable(version: string): boolean {
  return !(parse(version)?.isDev ?? true);
}

function isCompatible(version: string, current?: string): boolean {
  return true;
}

function getMajor(version: string | SemVer): null | number {
  return parse(version as string)?.asMajorMinor?.()?.[0] ?? null;
}
function getMinor(version: string | SemVer): null | number {
  return parse(version as string)?.asMajorMinor?.()?.[1] ?? null;
}

function getPatch(version: string | SemVer): null | number {
  try {
    return pep440.api.getPatch(version);
  } catch {
    return null;
  }
}

function isGreaterThan(version: string, other: string): boolean {
  return sortVersions(version, other) > 0;
}
function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const spec = new VersionSpec(range);

  const satisfiedVersions = versions
    .map((v) => {
      return [new Version(v), v] as const;
    })
    .filter(([v, raw]) => spec.matches(v))
    .sort((a, b) => {
      return a[0].compare(b[0]);
    });

  if (satisfiedVersions.length === 0) {
    return null;
  }

  return satisfiedVersions[satisfiedVersions.length - 1][1];
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const spec = new VersionSpec(range);

  const satisfiedVersions = versions
    .map((v) => {
      return [new Version(v), v] as const;
    })
    .filter(([v, raw]) => spec.matches(v))
    .sort((a, b) => {
      return a[0].compare(b[0]);
    });

  if (satisfiedVersions.length === 0) {
    return null;
  }

  return satisfiedVersions[0][1];
}

export const api = {
  equals,
  isValid,
  isVersion: isValidVersion,
  isSingleVersion,

  // conda doesn't have stable version and non-stable version
  // for example, tzdata has version 2024a but it's stable
  isStable,

  // conda use version are always compatible with each other.
  isCompatible,

  getMajor,
  getMinor,
  // sadly conda version doesn't have a concept of patch version
  // so we try to use pep440 get a patch version.
  getPatch,

  isGreaterThan,
  getSatisfyingVersion,

  minSatisfyingVersion,
  getNewValue,

  matches,
  sortVersions,
} satisfies VersioningApi;
