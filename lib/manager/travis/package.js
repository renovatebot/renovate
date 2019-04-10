const is = require('@sindresorhus/is');
const { isEqual } = require('lodash');
const { getPkgReleases } = require('../../datasource');
const { isVersion, maxSatisfyingVersion } = require('../../versioning/semver');

module.exports = {
  getPackageUpdates,
};

// Start version numbers as integers for correct sorting
const policies = {
  lts: [6, 8, 10],
  active: [8, 10, 11],
  current: [11],
  lts_active: [8, 10],
  lts_latest: [10],
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
    .sort((a, b) => a - b);
  const newMajor = newValue[newValue.length - 1];
  if (config.rangeStrategy === 'pin' || isVersion(config.currentValue[0])) {
    const versions = (await getPkgReleases({
      ...config,
      datasource: 'github',
      depName: 'nodejs/node',
    })).releases.map(release => release.version);
    newValue = newValue.map(value =>
      maxSatisfyingVersion(versions, `${value}`)
    );
  }
  if (is.string(config.currentValue[0])) {
    newValue = newValue.map(val => `${val}`);
  }
  newValue.sort((a, b) => a - b);
  config.currentValue.sort((a, b) => a - b);
  if (isEqual(config.currentValue, newValue)) {
    return [];
  }
  return [
    {
      newValue,
      newMajor,
      isRange: true,
      sourceUrl: 'https://github.com/nodejs/node',
    },
  ];
}
