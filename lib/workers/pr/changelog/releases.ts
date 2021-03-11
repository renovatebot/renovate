import {
  Release,
  getPkgReleases,
  isGetPkgReleasesConfig,
} from '../../../datasource';
import { logger } from '../../../logger';
import { VersioningApi, get } from '../../../versioning';
import type { BranchUpgradeConfig } from '../../types';

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
  const {
    versioning,
    currentVersion,
    newVersion,
    depName,
    datasource,
  } = config;
  // istanbul ignore if
  if (!isGetPkgReleasesConfig(config)) {
    return null;
  }
  try {
    const pkgReleases = (await getPkgReleases(config)).releases;
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
    if (version.valueToVersion) {
      for (const release of releases || []) {
        release.version = version.valueToVersion(release.version);
      }
    }
    return releases;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getInRangeReleases err');
    logger.debug({ datasource, depName }, 'Error getting releases');
    return null;
  }
}
