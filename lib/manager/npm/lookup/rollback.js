const {
  getMajor,
  isLessThan,
  rangify,
  sortVersions,
} = require('../../../versioning/semver');

module.exports = {
  getRollbackUpdate,
};

function getRollbackUpdate(config, versions) {
  const { packageFile, depName, currentVersion } = config;
  const lessThanVersions = versions.filter(version =>
    isLessThan(version, currentVersion)
  );
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.warn(
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
