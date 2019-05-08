const is = require('@sindresorhus/is');
const { isEqual } = require('lodash');
const { getPkgReleases } = require('../../datasource');
const { isVersion, maxSatisfyingVersion } = require('../../versioning/semver');
const nodeJsSchedule = require('./data/node-js-schedule.json');

module.exports = {
  getPackageUpdates,
};

let policies;

function generatePolicies() {
  policies = {
    all: [],
    lts: [],
    active: [],
    lts_active: [],
    lts_latest: [],
    current: [],
  };

  const now = new Date();

  for (const [vRelease, data] of Object.entries(nodeJsSchedule)) {
    const isAlive = new Date(data.start) < now && new Date(data.end) > now;
    if (isAlive) {
      const release = parseInt(vRelease.replace(/^v/, ''), 10);
      policies.all.push(release);
      const isMaintenance =
        data.maintenance && new Date(data.maintenance) < now;
      if (!isMaintenance) policies.active.push(release);
      const isLts = data.lts && new Date(data.lts) < now;
      if (isLts) {
        policies.lts.push(release);
        if (!isMaintenance) policies.lts_active.push(release);
      }
    }
  }
  policies.current.push(policies.active[policies.active.length - 1]);
  policies.lts_latest.push(policies.lts[policies.lts.length - 1]);
}

const initTime = new Date();
for (const data of Object.values(nodeJsSchedule)) {
  const fields = ['start', 'lts', 'maintenance', 'end'];
  for (const field of fields) {
    const fieldDate = new Date(data[field]);
    if (fieldDate > initTime) {
      const offsetmilliseconds = 1 + fieldDate.getTime() - initTime.getTime();
      // istanbul ignore if
      if (offsetmilliseconds < 10000000000) {
        global.renovateTimers = global.renovateTimers || [];
        global.renovateTimers.push(
          setTimeout(generatePolicies, offsetmilliseconds)
        );
      }
    }
  }
}

generatePolicies();

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
