const versioning = require('../../../../versioning/semver');
const moment = require('moment');
const { getRollbackUpdate } = require('./rollback');
const { getRangeStrategy } = require('./range');
const { filterVersions } = require('./filter');
const npmApi = require('../../../../datasource/npm');
const github = require('../../../../datasource/github');
const { parse } = require('../../../../../lib/util/purl');

const {
  getMajor,
  getMinor,
  isGreaterThan,
  isRange,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  rangify,
} = versioning;

module.exports = {
  lookupUpdates,
};

async function lookupUpdates(config) {
  const { depName, currentValue, lockedVersion } = config;
  logger.debug({ depName, currentValue }, 'lookupUpdates');
  let dependency;
  const purl = parse(config.purl);
  if (!purl) {
    logger.error('Missing purl');
    return [];
  }
  if (purl.type === 'npm') {
    npmApi.setNpmrc(
      config.npmrc,
      config.global ? config.global.exposeEnv : false
    );
    dependency = await npmApi.getDependency(purl.fullname);
  } else if (purl.type === 'github') {
    dependency = await github.getDependency(purl.fullname, purl.qualifiers);
  } else {
    logger.warn({ config }, 'Unknown purl');
    return [];
  }
  if (!dependency) {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: `Failed to look up dependency ${depName}`,
    };
    logger.info(
      { dependency: depName, packageFile: config.packageFile },
      result.message
    );
    return [result];
  }
  const { latestVersion } = dependency;
  const allVersions = Object.keys(dependency.versions);
  // istanbul ignore if
  if (allVersions.length === 0) {
    const message = `No versions returned from registry for this package`;
    logger.warn({ dependency }, message);
    return [
      {
        type: 'warning',
        message,
      },
    ];
  }
  const allSatisfyingVersions = allVersions.filter(version =>
    matches(version, currentValue)
  );
  const updates = [];
  if (!allSatisfyingVersions.length) {
    updates.push(getRollbackUpdate(config, allVersions));
  }
  const rangeStrategy = getRangeStrategy(config);
  const fromVersion = getFromVersion(
    currentValue,
    rangeStrategy,
    lockedVersion,
    allVersions
  );
  if (isRange(currentValue) && rangeStrategy === 'pin') {
    updates.push({
      type: 'pin',
      isPin: true,
      newVersion: fromVersion,
      newVersionMajor: getMajor(fromVersion),
      unpublishable: false,
    });
  }
  const filteredVersions = filterVersions(
    config,
    fromVersion,
    latestVersion,
    allVersions
  );
  if (!filteredVersions.length) {
    return updates;
  }
  const buckets = {};
  for (const toVersion of filteredVersions) {
    const update = { fromVersion, toVersion };
    update.newVersion = rangify(config, currentValue, fromVersion, toVersion);
    if (!update.newVersion || update.newVersion === currentValue) {
      continue; // eslint-disable-line no-continue
    }
    update.newVersionMajor = getMajor(toVersion);
    update.newVersionMinor = getMinor(toVersion);
    update.type = getType(config, fromVersion, toVersion);
    if (isRange(update.newVersion)) {
      update.isRange = true;
    }

    // TODO: move unpublishable to npm-specific
    const version = dependency.versions[toVersion];
    const elapsed =
      version && version.time
        ? moment().diff(moment(version.time), 'days')
        : 999;
    update.unpublishable = elapsed === 0;
    // end TODO

    const bucket = getBucket(config, update);
    if (buckets[bucket]) {
      if (isGreaterThan(update.toVersion, buckets[bucket].toVersion)) {
        buckets[bucket] = update;
      }
    } else {
      buckets[bucket] = update;
    }
  }
  let { repositoryUrl } = dependency;
  // istanbul ignore if
  if (!(repositoryUrl && repositoryUrl.length)) {
    repositoryUrl = null;
  }
  return updates
    .concat(Object.values(buckets))
    .map(update => ({ ...update, repositoryUrl }));
}

function getType(config, fromVersion, toVersion) {
  if (getMajor(toVersion) > getMajor(fromVersion)) {
    return 'major';
  }
  if (getMinor(toVersion) > getMinor(fromVersion)) {
    return 'minor';
  }
  if (config.separateMinorPatch) {
    return 'patch';
  }
  if (config.patch.automerge && !config.minor.automerge) {
    return 'patch';
  }
  return 'minor';
}

function getBucket(config, update) {
  const { separateMajorMinor, separateMultipleMajor } = config;
  const { type, newVersionMajor } = update;
  if (
    !separateMajorMinor ||
    config.groupName ||
    config.major.automerge === true ||
    (config.automerge && config.major.automerge !== false)
  ) {
    return 'latest';
  }
  if (separateMultipleMajor && type === 'major') {
    return `major-${newVersionMajor}`;
  }
  return type;
}

function getFromVersion(
  currentValue,
  rangeStrategy,
  lockedVersion,
  allVersions
) {
  if (!isRange(currentValue)) {
    return currentValue;
  }
  logger.trace(`currentValue ${currentValue} is range`);
  if (rangeStrategy === 'pin') {
    return lockedVersion || maxSatisfyingVersion(allVersions, currentValue);
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return minSatisfyingVersion(allVersions, currentValue);
  }
  // Use the highest version in the current range
  return maxSatisfyingVersion(allVersions, currentValue);
}
