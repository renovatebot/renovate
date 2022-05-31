import { logger } from '../../../../../logger';
import {
  Release,
  getPkgReleases,
  isGetPkgReleasesConfig,
} from '../../../../../modules/datasource';
import { VersioningApi, get } from '../../../../../modules/versioning';
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
  const { versioning, currentVersion, newVersion, depName, datasource } =
    config;
  // istanbul ignore if
  if (!currentVersion || !newVersion || !isGetPkgReleasesConfig(config)) {
    return null;
  }
  try {
    const releaseResult = await getPkgReleases(config);
    const pkgReleases = releaseResult?.releases;
    const version = get(versioning);

    if (pkgReleases) {
      const releases = pkgReleases
        .filter((release) =>
          version.isCompatible(release.version, currentVersion)
        )
        .filter(
          (release) =>
            version.equals(release.version, currentVersion) ||
            version.isGreaterThan(release.version, currentVersion)
        )
        .filter(
          (release) => !version.isGreaterThan(release.version, newVersion)
        )
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
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getInRangeReleases err');
    logger.debug({ datasource, depName }, 'Error getting releases');
  }
  return null;
}
