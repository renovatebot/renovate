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
  logger.debug('node.getPackageUpdates()');
  if (!Array.isArray(config.supportPolicy) || !config.supportPolicy.length) {
    return [];
  }
  const newVersion = config.supportPolicy
    .map(supportPolicy => policies[supportPolicy])
    .reduce((result, supportPolicy) => result.concat(supportPolicy), [])
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
