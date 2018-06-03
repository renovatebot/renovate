const got = require('got');
const versioning = require('../../versioning');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  try {
    logger.debug('pip_requirements.getPackageUpdates()');
    const { versionScheme, ignoreUnstable, currentVersion, depName } = config;
    const {
      isGreaterThan,
      sortVersions,
      isPinnedVersion,
      isStable,
      getMajor,
    } = versioning(versionScheme);
    if (!isPinnedVersion(currentVersion)) {
      return [];
    }
    const { releases } = (await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    })).body;
    const newVersions = Object.keys(releases)
      .filter(
        version =>
          isPinnedVersion(version) &&
          (isStable(version) || !ignoreUnstable) &&
          isGreaterThan(version, currentVersion)
      )
      .sort(sortVersions);

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
        fromVersion: currentVersion,
        toVersion: newVersion,
      },
    ];
  } catch (err) {
    logger.info({ err }, 'Error fetching new package versions');
    return [];
  }
}
