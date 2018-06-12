const nugetApi = require('../../datasource/nuget');
const {
  semverSort,
  isStable,
  isGreaterThan,
  getMajor,
  getMinor,
  isValid,
} = require('../../versioning/semver');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  const { currentVersion, depName, lineNumber, ignoreUnstable } = config;
  const upgrades = [];

  logger.debug('nuget.getPackageUpdates()');
  logger.trace({ config });

  const versions = await nugetApi.getVersions(depName);
  if (versions === undefined) {
    logger.warn('No versions retrieved from nuget');
    return upgrades;
  }
  const applicableVersions = ignoreUnstable
    ? versions.filter(v => isStable(v))
    : versions;
  const newVersion = applicableVersions.sort(semverSort).pop();

  if (!isValid(currentVersion)) {
    logger.debug({ newVersion }, 'Skipping non-semver current version.');
  } else if (!isValid(newVersion)) {
    logger.debug({ newVersion }, 'Skipping non-semver newVersion version.');
  } else if (
    newVersion !== undefined &&
    isGreaterThan(newVersion, currentVersion)
  ) {
    const upgrade = {};

    upgrade.newVersion = newVersion;
    upgrade.newVersionMajor = getMajor(newVersion);
    upgrade.newVersionMinor = getMinor(newVersion);
    upgrade.type =
      getMajor(newVersion) > getMajor(currentVersion) ? 'major' : 'minor';
    upgrade.lineNumber = lineNumber;
    upgrade.changeLogFromVersion = currentVersion;
    upgrade.changeLogToVersion = newVersion;

    upgrades.push(upgrade);
  }

  return upgrades;
}
