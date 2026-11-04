import { isString } from '@sindresorhus/is';
import type { SemVer } from 'semver';
import semver from 'semver';
import stable from 'semver-stable';
import { regEx } from '../../../util/regex.ts';
import { coerceString } from '../../../util/string.ts';
import { isBreaking as semverIsBreaking } from '../semver/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'semver-coerced';
export const displayName = 'Coerced Semantic Versioning';
export const urls = ['[Semantic Versioning](https://semver.org/)'];
export const supportsRanges = false;

function coerce(version: string | SemVer): SemVer | null {
  return semver.coerce(version, { loose: true });
}

function isStable(version: string): boolean {
  // matching a version with the semver prefix
  // v1.2.3, 1.2.3, v1.2, 1.2, v1, 1
  const regx = regEx(
    /^v?(?<major>\d+)(?<minor>\.\d+)?(?<patch>\.\d+)?(?<others>.+)?/,
  );
  const m = regx.exec(version);

  if (!m?.groups) {
    return false;
  }

  const minor = coerceString(m.groups.minor, '.0');
  const patch = coerceString(m.groups.patch, '.0');
  const others = coerceString(m.groups.others);
  const fixed = `${m.groups.major}${minor}${patch}${others}`.replace(
    regEx(/(?<prefix>^|\.)0+(?<digit>\d)/g),
    '$<prefix>$<digit>',
  );

  return stable.is(fixed);
}

function sortVersions(a: string, b: string): number {
  const aCoerced = coerce(a);
  const bCoerced = coerce(b);

  return aCoerced && bCoerced ? semver.compare(aCoerced, bCoerced) : 0;
}

function getMajor(a: string | SemVer): number | null {
  const aCoerced = coerce(a);
  return aCoerced ? semver.major(aCoerced) : null;
}

function getMinor(a: string | SemVer): number | null {
  const aCoerced = coerce(a);
  return aCoerced ? semver.minor(aCoerced) : null;
}

function getPatch(a: string | SemVer): number | null {
  const aCoerced = coerce(a);
  return aCoerced ? semver.patch(aCoerced) : null;
}

function matches(version: string, range: string): boolean {
  const coercedVersion = coerce(version);
  return coercedVersion ? semver.satisfies(coercedVersion, range) : false;
}

function equals(a: string, b: string): boolean {
  const aCoerced = coerce(a);
  const bCoerced = coerce(b);
  return aCoerced && bCoerced ? semver.eq(aCoerced, bCoerced) : false;
}

function isValid(version: string): boolean {
  return !!semver.valid(coerce(version));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const coercedVersions = versions
    .map((version) =>
      semver.valid(version) ? version : coerce(version)?.version,
    )
    .filter(isString);

  return semver.maxSatisfying(coercedVersions, range);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const coercedVersions = versions
    .map((version) => coerce(version)?.version)
    .filter(isString);

  return semver.minSatisfying(coercedVersions, range);
}

function isLessThanRange(version: string, range: string): boolean {
  const coercedVersion = coerce(version);
  return coercedVersion ? semver.ltr(coercedVersion, range) : false;
}

function isGreaterThan(version: string, other: string): boolean {
  const coercedVersion = coerce(version);
  const coercedOther = coerce(other);
  if (!coercedVersion || !coercedOther) {
    return false;
  }
  return semver.gt(coercedVersion, coercedOther);
}

const startsWithNumberRegex = regEx(`^\\d`);

function isSingleVersion(version: string): boolean {
  // Since coercion accepts ranges as well as versions, we have to manually
  // check that the version string starts with either 'v' or a digit.
  if (!version.startsWith('v') && !startsWithNumberRegex.exec(version)) {
    return false;
  }

  return !!semver.valid(coerce(version));
}

// If this is left as an alias, inputs like "17.04.0" throw errors
export function isVersion(input: string): boolean {
  return isValid(input);
}

export { getSatisfyingVersion, isVersion as isValid };

function getNewValue({
  currentValue,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (currentVersion === `v${currentValue}`) {
    return newVersion.replace(regEx(/^v/), '');
  }
  return newVersion;
}

function isBreaking(version: string, current: string): boolean {
  const coercedVersion = coerce(version)?.toString();
  const coercedCurrent = coerce(current)?.toString();
  return !!(
    coercedVersion &&
    coercedCurrent &&
    semverIsBreaking(coercedVersion, coercedCurrent)
  );
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isBreaking,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
