import { logger } from '../../../../../../logger';
import {
  GetPkgReleasesConfig,
  ReleaseResult,
  getPkgReleases,
} from '../../../../../datasource';
import { api as semver } from '../../../../../versioning/npm';

const pkgCache = new Map<string, Promise<ReleaseResult | null>>();

function getPkgReleasesCached(depName: string): Promise<ReleaseResult | null> {
  let cachedResult = pkgCache.get(depName);
  if (!cachedResult) {
    const lookupConfig: GetPkgReleasesConfig = {
      datasource: 'npm',
      depName,
    };
    cachedResult = getPkgReleases(lookupConfig);
    pkgCache.set(depName, cachedResult);
  }
  return cachedResult;
}

/**
 * Finds the first stable version of parentName after parentStartingVersion which either:
 * - depends on targetDepName@targetVersion or a range which it satisfies, OR
 * - removes the dependency targetDepName altogether, OR
 * - depends on any version of targetDepName higher than targetVersion
 */
export async function findFirstParentVersion(
  parentName: string,
  parentStartingVersion: string,
  targetDepName: string,
  targetVersion: string
): Promise<string | null> {
  // istanbul ignore if
  if (!semver.isVersion(parentStartingVersion)) {
    logger.debug('parentStartingVersion is not a version - cannot remediate');
    return null;
  }
  logger.debug(
    `Finding first version of ${parentName} starting with ${parentStartingVersion} which supports >= ${targetDepName}@${targetVersion}`
  );
  try {
    const targetDep = await getPkgReleasesCached(targetDepName);
    // istanbul ignore if
    if (!targetDep) {
      logger.warn(
        { targetDepName },
        'Could not look up target dependency for remediation'
      );
      return null;
    }
    const targetVersions = targetDep.releases
      .map((release) => release.version)
      .filter(
        (version) =>
          semver.isVersion(version) &&
          semver.isStable(version) &&
          (version === targetVersion ||
            semver.isGreaterThan(version, targetVersion))
      );
    const parentDep = await getPkgReleasesCached(parentName);
    // istanbul ignore if
    if (!parentDep) {
      logger.info(
        { parentName },
        'Could not look up parent dependency for remediation'
      );
      return null;
    }
    const parentVersions = parentDep.releases
      .map((release) => release.version)
      .filter(
        (version) =>
          semver.isVersion(version) &&
          semver.isStable(version) &&
          (version === parentStartingVersion ||
            semver.isGreaterThan(version, parentStartingVersion))
      )
      .sort((v1, v2) => semver.sortVersions(v1, v2));
    // iterate through parentVersions in sorted order
    for (const parentVersion of parentVersions) {
      const constraint = parentDep.releases.find(
        (release) => release.version === parentVersion
      )?.dependencies?.[targetDepName];
      if (!constraint) {
        logger.debug(
          `${targetDepName} has been removed from ${parentName}@${parentVersion}`
        );
        return parentVersion;
      }
      if (semver.matches(targetVersion, constraint)) {
        // could be version or range
        logger.debug(
          `${targetDepName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to ${targetVersion}`
        );
        return parentVersion;
      }
      if (semver.isVersion(constraint)) {
        if (semver.isGreaterThan(constraint, targetVersion)) {
          // it's not the version we were after - the parent skipped to a higher version
          logger.debug(
            `${targetDepName} needs ${parentName}@${parentVersion} which uses version "${constraint}" in order to update to greater than ${targetVersion}`
          );
          return parentVersion;
        }
      } else if (
        // check the range against all versions
        targetVersions.some((version) => semver.matches(version, constraint))
      ) {
        // the constraint didn't match the version we wanted, but it matches one of the versions higher
        logger.debug(
          `${targetDepName} needs ${parentName}@${parentVersion} which uses constraint "${constraint}" in order to update to greater than ${targetVersion}`
        );
        return parentVersion;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn(
      { parentName, parentStartingVersion, targetDepName, targetVersion, err },
      'findFirstParentVersion error'
    );
    return null;
  }
  logger.debug(`Could not find a matching version`);
  return null;
}
