const got = require('got');
const {
  isGreaterThan,
  semverSort,
  isPinnedVersion,
  getMajor,
} = require('../../util/semver');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  try {
    logger.debug('pip_requirements.getPackageUpdates()');
    const { currentVersion, depName } = config;
    if (!isPinnedVersion(currentVersion)) {
      return [];
    }
    const { releases } = (await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    })).body;
    const newVersions = Object.keys(releases)
      .filter(
        release =>
          isPinnedVersion(release) && isGreaterThan(release, currentVersion)
      )
      .sort(semverSort);

    if (newVersions.length) {
      logger.info({ newVersions, depName }, 'Found newer Python releases');
    } else {
      return [];
    }

    const newVersion = newVersions.pop();

    return [
      {
        depName,
        newVersion,
        newVersionMajor: getMajor(newVersion),
        changeLogFromVersion: currentVersion,
        changeLogToVersion: newVersion,
      },
    ];
  } catch (err) {
    logger.info({ err }, 'Error fetching new package versions');
    return [];
  }
}
