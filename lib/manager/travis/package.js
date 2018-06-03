const { isEqual } = require('lodash');
const { getDependency } = require('../../datasource/github');
const versioning = require('../../versioning');

const { isVersion, maxSatisfyingVersion } = versioning('semver');

module.exports = {
  getPackageUpdates,
};

// Start version numbers as integers for correct sorting
const policies = {
  lts: [6, 8],
  active: [8, 10],
  current: [10],
  lts_active: [8],
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
  let newValue = supportPolicy
    .map(policy => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort() // sort combined array
    .reverse() // we want to order latest to oldest
    .map(version => `${version}`); // convert to strings
  if (config.rangeStrategy === 'pin' || isVersion(config.currentValue[0])) {
    const releases = Object.keys(
      (await getDependency('nodejs/node', { clean: 'true' })).versions
    );
    newValue = newValue.map(version => maxSatisfyingVersion(releases, version));
  }
  if (isEqual([...config.currentValue].sort(), [...newValue].sort())) {
    return [];
  }
  return [
    {
      newValue,
      isRange: true,
      repositoryUrl: 'https://github.com/nodejs/node',
    },
  ];
}
