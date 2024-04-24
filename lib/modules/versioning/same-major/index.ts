import { api as semverCoerced } from '../semver-coerced';
import type { VersioningApi } from '../types';

export const id = 'same-major';
export const displayName = 'Same Major Versioning';
export const urls = [];
export const supportsRanges = false;

/**
 *
 * Converts input to range if it's a version. eg. X.Y.Z -> '>=X.Y.Z <X+1'
 * If the input is already a range, it returns the input.
 */
function massageVersion(input: string): string {
  // return the input if it is a range
  if (!semverCoerced.isSingleVersion(input)) {
    return input;
  }

  // we are sure to get a major because of the isSingleVersion check
  const major = semverCoerced.getMajor(input)!;
  return `>=${input} <${major + 1}`;
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
  return semverCoerced.isLessThanRange!(version, massageVersion(range));
}

export const api: VersioningApi = {
  ...semverCoerced,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
};
export default api;
