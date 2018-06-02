const versioning = require('../../../../versioning');

module.exports = {
  getRollbackUpdate,
};

function getRollbackUpdate(config, versions) {
  const { packageFile, versionScheme, depName, currentVersion } = config;
  const {
    isPinnedVersion,
    getMajor,
    isLessThan,
    rangify,
    sortVersions,
    minSatisfyingVersion,
  } = versioning(versionScheme);

  const minVersion = isPinnedVersion(currentVersion)
    ? currentVersion
    : minSatisfyingVersion(versions, currentVersion);
  const lessThanVersions = !minVersion
    ? []
    : versions.filter(version => isLessThan(version, minVersion));
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.info(
      { packageFile, depName, currentVersion },
      'Missing version has nothing to roll back to'
    );
    return [];
  }
  logger.info(
    { packageFile, depName, currentVersion },
    `Current version not found - rolling back`
  );
  lessThanVersions.sort(sortVersions);
  const toVersion = lessThanVersions.pop();
  let fromVersion;
  const newVersion = rangify(config, currentVersion, fromVersion, toVersion);
  return {
    type: 'rollback',
    branchName:
      '{{{branchPrefix}}}rollback-{{{depNameSanitized}}}-{{{newVersionMajor}}}.x',
    commitMessageAction: 'Roll back',
    isRollback: true,
    newVersion,
    newVersionMajor: getMajor(toVersion),
    semanticCommitType: 'fix',
    unpublishable: false,
  };
}
