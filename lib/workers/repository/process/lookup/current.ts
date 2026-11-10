import { isString } from '@sindresorhus/is';
import type { Release } from '../../../../modules/datasource/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { regEx } from '../../../../util/regex.ts';

export function getCurrentVersion(
  currentValue: string,
  lockedVersion: string,
  versioningApi: VersioningApi,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[],
): string | null {
  // istanbul ignore if
  if (!isString(currentValue)) {
    return null;
  }
  let useVersions = allVersions.filter((v) =>
    versioningApi.matches(v, currentValue),
  );
  if (useVersions.length === 1) {
    return useVersions[0];
  }
  if (latestVersion && versioningApi.matches(latestVersion, currentValue)) {
    useVersions = useVersions.filter(
      (v) => !versioningApi.isGreaterThan(v, latestVersion),
    );
  }
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion ||
      versioningApi.getSatisfyingVersion(useVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return versioningApi.minSatisfyingVersion(useVersions, currentValue);
  }
  // Use the highest version in the current range
  const satisfyingVersion = versioningApi.getSatisfyingVersion(
    useVersions,
    currentValue,
  );
  if (satisfyingVersion) {
    return satisfyingVersion;
  }

  if (versioningApi.isVersion(currentValue)) {
    return currentValue;
  }
  if (versioningApi.isSingleVersion(currentValue)) {
    return currentValue.replace(regEx(/=/g), '').trim();
  }

  return null;
}

/**
 * Run `getCurrentVersion()` over the non-deprecated releases first, falling back to all of them.
 */
function getCurrentVersionFromReleases(
  compareValue: string | undefined,
  lockedVersion: string | undefined,
  versioningApi: VersioningApi,
  rangeStrategy: string | null | undefined,
  latestVersion: string | undefined,
  releases: Release[],
): string | null {
  return (
    getCurrentVersion(
      // TODO #22198
      compareValue!,
      lockedVersion!,
      versioningApi,
      rangeStrategy!,
      latestVersion!,
      releases
        .filter((release) => !release.isDeprecated)
        .map((release) => release.version),
    ) ??
    getCurrentVersion(
      compareValue!,
      lockedVersion!,
      versioningApi,
      rangeStrategy!,
      latestVersion!,
      releases.map((release) => release.version),
    )
  );
}

/**
 * Resolve the version `currentValue` is treated as being at, preferring
 * non-deprecated releases and falling back to all of them.
 */
export function resolveCurrentVersion(
  compareValue: string | undefined,
  lockedVersion: string | undefined,
  versioningApi: VersioningApi,
  rangeStrategy: string | null | undefined,
  latestVersion: string | undefined,
  releases: Release[],
): string | undefined {
  let currentVersion: string | undefined;
  if (rangeStrategy === 'update-lockfile') {
    currentVersion = lockedVersion;
  } else if (
    compareValue &&
    versioningApi.isSingleVersion(compareValue) &&
    releases.some((release) => release.version === compareValue)
  ) {
    currentVersion = compareValue;
  }

  currentVersion ??=
    getCurrentVersionFromReleases(
      compareValue,
      lockedVersion,
      versioningApi,
      rangeStrategy,
      latestVersion,
      releases,
    ) ?? undefined;

  return currentVersion;
}

/**
 * Resolve the newest version matching `compareValue`, regardless of the
 * configured `rangeStrategy`.
 *
 * This is the release a `digest`/`pinDigest` update's current value resolves
 * to right now, so it is what such an update must be aged against.
 */
export function getNewestMatchingVersion(
  compareValue: string | undefined,
  versioningApi: VersioningApi,
  latestVersion: string | undefined,
  releases: Release[],
): string | null {
  // Resolve from the already filtered releases, so that filters like followTag apply - like `resolveCurrentVersion()`, but always with the `replace` range strategy.
  return getCurrentVersionFromReleases(
    compareValue,
    '',
    versioningApi,
    'replace',
    latestVersion,
    releases,
  );
}
