import is from '@sindresorhus/is';
import semver, { SemVer } from 'semver';
import stable from 'semver-stable';
import { regEx } from '../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'semver-coerced';
export const displayName = 'Coerced Semantic Versioning';
export const urls = ['https://semver.org/'];
export const supportsRanges = false;

const { is: isStable } = stable;

function sortVersions(a: string, b: string): number {
  const aCoerced = semver.coerce(a);
  const bCoerced = semver.coerce(b);

  return aCoerced && bCoerced ? semver.compare(aCoerced, bCoerced) : 0;
}

function getMajor(a: string | SemVer): number | null {
  const aCoerced = semver.coerce(a);
  return aCoerced ? semver.major(aCoerced) : null;
}

function getMinor(a: string | SemVer): number | null {
  const aCoerced = semver.coerce(a);
  return aCoerced ? semver.minor(aCoerced) : null;
}

function getPatch(a: string | SemVer): number | null {
  return semver.patch(a);
}

function matches(version: string, range: string): boolean {
  const coercedVersion = semver.coerce(version);
  return coercedVersion ? semver.satisfies(coercedVersion, range) : false;
}

function equals(a: string, b: string): boolean {
  const aCoerced = semver.coerce(a);
  const bCoerced = semver.coerce(b);
  return aCoerced && bCoerced ? semver.eq(aCoerced, bCoerced) : false;
}

function isValid(version: string): string | boolean | null {
  return semver.valid(semver.coerce(version));
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const coercedVersions = versions
    .map((version) => semver.coerce(version)?.version)
    .filter(is.string);

  return semver.maxSatisfying(coercedVersions, range);
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const coercedVersions = versions
    .map((version) => semver.coerce(version)?.version)
    .filter(is.string);

  return semver.minSatisfying(coercedVersions, range);
}

function isLessThanRange(version: string, range: string): boolean {
  const coercedVersion = semver.coerce(version);
  return coercedVersion ? semver.ltr(coercedVersion, range) : false;
}

function isGreaterThan(version: string, other: string): boolean {
  const coercedVersion = semver.coerce(version);
  const coercedOther = semver.coerce(other);
  return coercedVersion && coercedOther
    ? semver.gt(coercedVersion, coercedOther)
    : false;
}

const startsWithNumberRegex = regEx(`^\\d`);

function isSingleVersion(version: string): string | boolean | null {
  // Since coercion accepts ranges as well as versions, we have to manually
  // check that the version string starts with either 'v' or a digit.
  if (!version.startsWith('v') && !startsWithNumberRegex.exec(version)) {
    return null;
  }

  return semver.valid(semver.coerce(version));
}

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isVersion = (input: string): string | boolean | null =>
  isValid(input);

export { isVersion as isValid, getSatisfyingVersion };

function getNewValue({ newVersion }: NewValueConfig): string {
  return newVersion;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
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
