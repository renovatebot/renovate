import semver from 'semver';
import semverVersioning from '../semver';
import { api as semverCoerced } from '../semver-coerced';
import type { VersioningApi } from '../types';

export const id = 'same-major';
export const displayName = 'Same Major Versioning';
// export const urls = ['https://semver.org/'];
export const supportsRanges = true;

/**
 *
 * Converts input to range if it's a version
 * eg. 1.0.0 -> >=1.0.0 <2.0.0
 * If range is input no change is made
 */
function massageVersion(input: string): string {
  let res = input;
  const major = semverCoerced.getMajor(res);
  if (semverVersioning.isValid(res) && major !== null) {
    const upperLimit = semver.coerce(major + 1);
    const max = upperLimit ? upperLimit.version : `${major + 1}.0.0`;
    res = `>=${input} <${max}`;
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
  return semverCoerced.isLessThanRange
    ? semverCoerced.isLessThanRange(version, massageVersion(range))
    : false;
}

export const api: VersioningApi = {
  ...semverCoerced,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
};
export default api;
