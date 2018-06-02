const got = require('got');
const versioning = require('../../versioning');

const { isGreaterThan, sortVersions, isPinnedVersion, getMajor } = versioning(
  'pep440'
);

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
