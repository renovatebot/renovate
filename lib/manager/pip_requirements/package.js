const got = require('got');
const {
  isGreaterThan,
  semverSort,
  isPinnedVersion,
} = require('../../util/semver');

module.exports = {
  getPackageUpdates,
};

function isValidVersion(version) {
  try {
    return isPinnedVersion(version);
  } catch (error) {
    return false;
  }
}

async function getPackageUpdates(config) {
  const { currentVersion, depName } = config;
  const { releases } = (await got(`https://pypi.org/pypi/${depName}/json`, {
    json: true,
  })).body;
  const newVersions = Object.keys(releases)
    .filter(isValidVersion)
    .filter(release => isGreaterThan(release, currentVersion))
    .sort(semverSort);

  if (newVersions.length) {
    logger.info({ newVersions, depName }, 'Found newer Python releases');
  } else {
    return [];
  }

  const newVersion = newVersions.pop();

  return [
    {
      newVersion,
      depName,
    },
  ];
}
