import semver from 'semver';
import semverVersioning from '../semver';
import { api as semverCoerced } from '../semver-coerced';
import type { VersioningApi } from '../types';

export const id = 'same-major';
export const displayName = 'Same Major Versioning';
export const urls = [];
export const supportsRanges = true;

/**
 *
 * Converts input to range if it's a version. eg. X.Y.Z -> '>=X.Y.Z <X+1.0.0'
 * If the input is already a range, it returns the input.
 */
function massageVersion(input: string): string {
  let res = input;
  const major = semverCoerced.getMajor(res);
  if (semverVersioning.isValid(res) && major !== null) {
    const nextMajor = semver.coerce(major + 1);
    const nextMajorVersion = nextMajor ? nextMajor.version : `${major + 1}.0.0`;
    res = `>=${input} <${nextMajorVersion}`;
  }

  return res;
}

function matches(version: string, range: string): boolean {
  return semverCoerced.matches(version, massageVersion(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return semverCoerced.getSatisfyingVersion(versions, massageVersion(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return semverCoerced.minSatisfyingVersion(versions, massageVersion(range));
}

function isLessThanRange(version: string, range: string): boolean {
  return !!semverCoerced.isLessThanRange?.(version, massageVersion(range));
}

export const api: VersioningApi = {
  ...semverCoerced,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
};
export default api;
