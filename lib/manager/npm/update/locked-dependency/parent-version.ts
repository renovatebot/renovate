import { GetPkgReleasesConfig, getPkgReleases } from '../../../../datasource';
import { logger } from '../../../../logger';
import { api as semver } from '../../../../versioning/npm';

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
  logger.debug(
    `Finding first version of ${parentName} starting with ${parentStartingVersion} which supports >= ${targetDepName}@${targetVersion}`
  );
  try {
    let lookupConfig: GetPkgReleasesConfig = {
      datasource: 'npm',
      depName: targetDepName,
    };
    const targetDep = await getPkgReleases(lookupConfig);
    const targetVersions = targetDep.releases
      .map((release) => release.version)
      .filter(
        (version) =>
          semver.isStable(version) &&
          (version === targetVersion ||
            semver.isGreaterThan(version, targetVersion))
      );
    lookupConfig = {
      datasource: 'npm',
      depName: parentName,
    };
    const parentDep = await getPkgReleases(lookupConfig);
    const parentVersions = parentDep.releases
      .map((release) => release.version)
      .filter(
        (version) =>
          semver.isStable(version) &&
          (version === parentStartingVersion ||
            semver.isGreaterThan(version, parentStartingVersion))
      )
      .sort((v1, v2) => semver.sortVersions(v1, v2));
    // iterate through parentVersions in sorted order
    for (const parentVersion of parentVersions) {
      const constraint = parentDep.releases.find(
        (release) => release.version === parentVersion
      ).dependencies?.[targetDepName];
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
    logger.warn({ err }, 'findFirstSupportingVersion error');
    return null;
  }
  logger.debug(`Could not find a matching version`);
  return null;
}
