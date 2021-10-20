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
  return semver.compare(semver.coerce(a), semver.coerce(b));
}

function getMajor(a: string | SemVer): number | null {
  return semver.major(semver.coerce(a));
}

function getMinor(a: string | SemVer): number | null {
  return semver.minor(semver.coerce(a));
}

function getPatch(a: string | SemVer): number | null {
  return semver.patch(a);
}

function matches(version: string, range: string): boolean {
  return semver.satisfies(semver.coerce(version), range);
}

function equals(a: string, b: string): boolean {
  return semver.eq(semver.coerce(a), semver.coerce(b));
}

function isValid(version: string): string | boolean | null {
  return semver.valid(semver.coerce(version));
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const coercedVersions = versions.map((version) => {
    const coercedVersion = semver.coerce(version);
    return coercedVersion ? coercedVersion.version : null;
  });
  return semver.maxSatisfying(coercedVersions, range);
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  const coercedVersions = versions.map((version) => {
    const coercedVersion = semver.coerce(version);
    return coercedVersion ? coercedVersion.version : null;
  });
  return semver.minSatisfying(coercedVersions, range);
}

function isLessThanRange(version: string, range: string): boolean {
  return semver.ltr(semver.coerce(version), range);
}

function isGreaterThan(version: string, other: string): boolean {
  return semver.gt(semver.coerce(version), semver.coerce(other));
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
export const isVersion = (input: string): string | boolean => isValid(input);

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
