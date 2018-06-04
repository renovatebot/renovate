const got = require('got');
const versioning = require('../../versioning');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  try {
    logger.debug('pip_requirements.getPackageUpdates()');
    const { versionScheme, ignoreUnstable, currentValue, depName } = config;
    const {
      isGreaterThan,
      sortVersions,
      isVersion,
      isStable,
      getMajor,
    } = versioning(versionScheme);
    if (!iVVersion(currentVersion)) {
      return [];
    }
    const { releases } = (await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    })).body;
    const newVersions = Object.keys(releases)
      .filter(
        version =>
          isVersion(version) &&
          (isStable(version) || !ignoreUnstable) &&
          isGreaterThan(version, currentValue)
      )
      .sort(sortVersions);

    if (newVersions.length) {
      logger.info({ newVersions, depName }, 'Found newer Python releases');
    } else {
      return [];
    }

    const newValue = newVersions.pop();

    return [
      {
        depName,
        newValue,
        newMajor: getMajor(newValue),
        fromVersion: currentValue,
        toVersion: newValue,
      },
    ];
  } catch (err) {
    logger.info({ err }, 'Error fetching new package versions');
    return [];
  }
}
