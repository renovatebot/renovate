const npmApi = require('../../datasource/npm');
const lookup = require('./lookup');
const { isValid } = require('../../versioning/semver');
const nodeManager = require('../_helpers/node/package');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.trace({ config }, `npm.getPackageUpdates()`);
  const { depType, depName, currentVersion } = config;
  if (depType === 'engines') {
    if (depName !== 'node') {
      logger.debug('Skipping non-node engine');
      return [];
    }
    return nodeManager.getPackageUpdates(config);
  }
  let results = [];
  if (currentVersion === '*') {
    logger.debug(
      { dependency: depName, currentVersion },
      'Skipping * dependency'
    );
    return [];
  }
  if (currentVersion.startsWith('file:')) {
    logger.debug(
      { dependency: depName, currentVersion },
      'Skipping file: dependency'
    );
    return [];
  }
  if (!isValid(currentVersion)) {
    results.push({
      depName,
      type: 'warning',
      message: `Dependency uses tag "\`${currentVersion}\`" as its version so that will never be changed by Renovate`,
    });
    logger.debug(results[0].message);
    return results;
  }
  npmApi.setNpmrc(
    config.npmrc,
    config.global ? config.global.exposeEnv : false
  );
  results = await lookup.lookupUpdates(config);
  // istanbul ignore if
  if (results.length > 0 && results[0].type !== 'warning') {
    logger.info(
      { dependency: depName },
      `${results.length} result(s): ${results.map(
        upgrade => upgrade.newVersion
      )}`
    );
  }
  return results;
}
