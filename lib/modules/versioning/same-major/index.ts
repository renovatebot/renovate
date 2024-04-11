import is from '@sindresorhus/is';
import semver from 'semver';
import { api as semverCoerced } from '../semver-coerced';
import type { VersioningApi } from '../types';

export const id = 'same-major';
export const displayName = 'Same Major Versioning';
// export const urls = ['https://semver.org/'];
export const supportsRanges = true;

function matches(version: string, range: string): boolean {
  const coercedVersion = semver.coerce(version);
  let newRange = range;
  if (!semverCoerced.isSingleVersion(range)) {
    const major = semverCoerced.getMajor(range) ?? 0;
    const min = semver.coerce(major)?.version;
    const max = semver.coerce(major + 1)?.version;
    newRange = `>=${min} <${max}`;
  }

  return coercedVersion ? semver.satisfies(coercedVersion, newRange) : false;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const coercedVersions = versions
    .map((version) =>
      semver.valid(version) ? version : semver.coerce(version)?.version,
    )
    .filter(is.string);

  return semver.maxSatisfying(coercedVersions, range);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
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

export const api: VersioningApi = {
  ...semverCoerced,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
};
export default api;
