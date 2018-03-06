const { isEqual } = require('lodash');

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

function getPackageUpdates(config) {
  logger.debug('travis.getPackageUpdates()');
  let { supportPolicy } = config;
  if (!(supportPolicy && supportPolicy.length)) {
    supportPolicy = ['lts'];
  }
  const newVersion = supportPolicy
    .map(policy => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort() // sort combined array
    .reverse() // we want to order latest to oldest
    .map(version => `${version}`); // convert to strings
  logger.debug({ newVersion });
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
