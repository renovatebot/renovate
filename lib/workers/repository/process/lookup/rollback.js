const versioning = require('../../../../versioning');

module.exports = {
  getRollbackUpdate,
};

function getRollbackUpdate(config, versions) {
  const { packageFile, versionScheme, depName, currentValue } = config;
  const { getMajor, isLessThanRange, rangify, sortVersions } = versioning(
    versionScheme
  );
  // istanbul ignore if
  if (!isLessThanRange) {
    logger.info(
      { versionScheme },
      'Current version scheme does not suppot isLessThanRange()'
    );
    return [];
  }
  const lessThanVersions = versions.filter(version =>
    isLessThanRange(version, currentValue)
  );
  // istanbul ignore if
  if (!lessThanVersions.length) {
    logger.info(
      { packageFile, depName, currentValue },
      'Missing version has nothing to roll back to'
    );
    return [];
  }
  logger.info(
    { packageFile, depName, currentValue },
    `Current version not found - rolling back`
  );
  lessThanVersions.sort(sortVersions);
  const toVersion = lessThanVersions.pop();
  let fromVersion;
  const newVersion = rangify(config, currentValue, fromVersion, toVersion);
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
