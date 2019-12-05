import { getPkgReleases, Release, PkgReleaseConfig } from '../../../datasource';
import { logger } from '../../../logger';
import { get, VersioningApi } from '../../../versioning';

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

export type ReleaseConfig = PkgReleaseConfig & {
  fromVersion: string;
  releases?: Release[];
  sourceUrl?: string;
  toVersion: string;
};

export async function getReleases(
  config: ReleaseConfig
): Promise<Release[] | null> {
  const { versionScheme, fromVersion, toVersion, depName, datasource } = config;
  try {
    const pkgReleases = (await getPkgReleases(config)).releases;
    const version = get(versionScheme);

    const releases = pkgReleases
      .filter(release => version.isCompatible(release.version, fromVersion))
      .filter(
        release =>
          version.equals(release.version, fromVersion) ||
          version.isGreaterThan(release.version, fromVersion)
      )
      .filter(release => !version.isGreaterThan(release.version, toVersion))
      .filter(
        release =>
          version.isStable(release.version) ||
          matchesUnstable(version, fromVersion, release.version) ||
          matchesUnstable(version, toVersion, release.version)
      );
    if (version.valueToVersion) {
      for (const release of releases || []) {
        release.version = version.valueToVersion(release.version);
      }
    }
    return releases;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getReleases err');
    logger.info({ datasource, depName }, 'Error getting releases');
    return null;
  }
}
