const {
  isGreaterThan,
  isPinnedVersion,
  sortVersions,
  getMajor,
  getMinor,
} = require('../../versioning/semver');
const { getRepoTags } = require('../../datasource/github');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  const { depName, currentVersion } = config;
  logger.debug({ depName }, 'buildkite.getPackageUpdates()');
  if (depName.startsWith('https://') || depName.startsWith('git@')) {
    logger.debug({ depName }, 'Skipping git plugin');
    return [];
  }
  if (!isPinnedVersion(currentVersion)) {
    logger.debug({ currentVersion }, 'Skipping non-pinned current version');
    return [];
  }
  let sourceRepo = '';
  const splitName = depName.split('/');
  if (splitName.length === 1) {
    sourceRepo = `buildkite-plugins/${depName}-buildkite-plugin`;
  } else if (splitName.length === 2) {
    sourceRepo = `${depName}-buildkite-plugin`;
  } else {
    logger.warn({ depName }, 'Something is wrong with buildkite plugin name');
    return [];
  }
  const repoTags = await getRepoTags(sourceRepo);
  const newerVersions = repoTags
    .filter(tag => isGreaterThan(tag, currentVersion))
    .sort(sortVersions);
  if (newerVersions.length) {
    logger.debug({ newerVersions }, 'Found newer versions');
  } else {
    return [];
  }
  const newVersion = newerVersions.pop();
  return [
    {
      type: getMajor(newVersion) > getMajor(currentVersion) ? 'major' : 'minor',
      newVersion,
      newVersionMajor: getMajor(newVersion),
      newVersionMinor: getMinor(newVersion),
      fromVersion: currentVersion,
      toVersion: newVersion,
      repositoryUrl: `https://github.com/${sourceRepo}`,
    },
  ];
}
