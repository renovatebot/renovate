const got = require('got');
const {
  isGreaterThan,
  sortVersions,
  isPinnedVersion,
  getMajor,
} = require('../../versioning/semver');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  try {
    logger.debug('pip_requirements.getPackageUpdates()');
    const { currentValue, depName } = config;
    if (!isPinnedVersion(currentValue)) {
      return [];
    }
    const { releases } = (await got(`https://pypi.org/pypi/${depName}/json`, {
      json: true,
    })).body;
    const newVersions = Object.keys(releases)
      .filter(
        release =>
          isPinnedVersion(release) && isGreaterThan(release, currentValue)
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
