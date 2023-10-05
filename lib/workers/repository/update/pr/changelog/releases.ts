// TODO #22198
import { logger } from '../../../../../logger';
import {
  Release,
  getPkgReleases,
  isGetPkgReleasesConfig,
} from '../../../../../modules/datasource';
import { VersioningApi, get } from '../../../../../modules/versioning';
import { coerceArray } from '../../../../../util/array';
import type { BranchUpgradeConfig } from '../../../../types';

function matchesMMP(version: VersioningApi, v1: string, v2: string): boolean {
  return (
    version.getMajor(v1) === version.getMajor(v2) &&
    version.getMinor(v1) === version.getMinor(v2) &&
    version.getPatch(v1) === version.getPatch(v2)
  );
}

function matchesUnstable(
  version: VersioningApi,
  v1: string,
  v2: string
): boolean {
  return !version.isStable(v1) && matchesMMP(version, v1, v2);
}

export async function getInRangeReleases(
  config: BranchUpgradeConfig
): Promise<Release[] | null> {
  const versioning = config.versioning!;
  const currentVersion = config.currentVersion!;
  const newVersion = config.newVersion!;
  const depName = config.depName!;
  const datasource = config.datasource!;
  // istanbul ignore if
  if (!isGetPkgReleasesConfig(config)) {
    return null;
  }
  try {
    const pkgReleases = (await getPkgReleases(config))!.releases;
    const version = get(versioning);

    const releases = pkgReleases
      .filter((release) =>
        version.isCompatible(release.version, currentVersion)
      )
      .filter(
        (release) =>
          version.equals(release.version, currentVersion) ||
          version.isGreaterThan(release.version, currentVersion)
      )
      .filter((release) => !version.isGreaterThan(release.version, newVersion))
      .filter(
        (release) =>
          version.isStable(release.version) ||
          matchesUnstable(version, currentVersion, release.version) ||
          matchesUnstable(version, newVersion, release.version)
      );

    // if there is only 1 release it can be one of two things
    // either there is only 1 release OR the pinned version actually doesn't exist
    // i.e pinning to 1.2.3 but only 1.2.4, 1.2.2 exists
    if (releases.length === 1) {
      const newRelease = releases[0];
      const anyPreviousValidRelease = pkgReleases.filter(
        (release) => !version.isGreaterThan(release.version, newVersion)
      )[0];
      //  TODO: how do we sort these
      if (
        anyPreviousValidRelease &&
        anyPreviousValidRelease.version !== newRelease.version
      ) {
        releases.unshift(anyPreviousValidRelease);
      }
    }

    if (version.valueToVersion) {
      for (const release of coerceArray(releases)) {
        release.version = version.valueToVersion(release.version);
      }
    }
    return releases;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getInRangeReleases err');
    logger.debug(`Error getting releases for ${depName} from ${datasource}`);
    return null;
  }
}
