const { isEqual } = require('lodash');
const { getRepoReleases } = require('../../datasource/github');
const { isPinnedVersion, maxSatisfyingVersion } = require('../../util/semver');

module.exports = {
  getPackageUpdates,
};

// Start version numbers as integers for correct sorting
const policies = {
  lts: [4, 6, 8],
  active: [6, 8, 9],
  current: [9],
  lts_active: [6, 8],
  lts_latest: [8],
};

async function getPackageUpdates(config) {
  logger.debug('travis.getPackageUpdates()');
  const { supportPolicy } = config;
  if (!(supportPolicy && supportPolicy.length)) {
    return [];
  }
  for (const policy of supportPolicy) {
    if (!Object.keys(policies).includes(policy)) {
      logger.warn(`Unknown supportPolicy: ${policy}`);
      return [];
    }
  }
  logger.debug({ supportPolicy }, `supportPolicy`);
  let newVersion = supportPolicy
    .map(policy => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort() // sort combined array
    .reverse() // we want to order latest to oldest
    .map(version => `${version}`); // convert to strings
  if (config.pinVersions || isPinnedVersion(config.currentVersion[0])) {
    const releases = await getRepoReleases('nodejs/node');
    newVersion = newVersion.map(version =>
      maxSatisfyingVersion(releases, version).replace(/^v/, '')
    );
  }
  if (isEqual([...config.currentVersion].sort(), [...newVersion].sort())) {
    return [];
  }
  return [
    {
      newVersion,
      isRange: true,
      repositoryUrl: 'https://github.com/nodejs/node',
    },
  ];
}
