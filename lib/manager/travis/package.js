const { isEqual } = require('lodash');
const semver = require('semver');
const { getRepoReleases } = require('../../datasource/github');

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
  let { supportPolicy } = config;
  if (!(supportPolicy && supportPolicy.length)) {
    supportPolicy = ['lts'];
  }
  let newVersion = supportPolicy
    .map(policy => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort() // sort combined array
    .reverse() // we want to order latest to oldest
    .map(version => `${version}`); // convert to strings
  logger.debug({ newVersion });
  if (config.pinVersions || semver.valid(config.currentVersion[0])) {
    const releases = await getRepoReleases('nodejs/node');
    newVersion = newVersion.map(version =>
      semver.maxSatisfying(releases, version).replace(/^v/, '')
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
