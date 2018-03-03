const npmApi = require('../../datasource/npm');
const versions = require('../../workers/package/versions');
const nodeManager = require('../_helpers/node/package');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  if (config.depType === 'engines') {
    if (config.depName !== 'node') {
      logger.debug('Skipping non-node engine');
      return [];
    }
    return nodeManager.getPackageUpdates(config);
  }
  let results = [];
  if (config.currentVersion.startsWith('file:')) {
    logger.debug(
      { dependency: config.depName, currentVersion: config.currentVersion },
      'Skipping file: dependency'
    );
    return [];
  }
  if (!versions.isValidVersion(config.currentVersion)) {
    results.push({
      depName: config.depName,
      type: 'warning',
      message: `Dependency uses tag "\`${
        config.currentVersion
      }\`" as its version so that will never be changed by Renovate`,
    });
    logger.debug(results[0].message);
    return results;
  }
  const npmDep = await npmApi.getDependency(config.depName);
  if (npmDep) {
    results = await versions.determineUpgrades(npmDep, config);
    if (results.length > 0) {
      logger.info(
        { dependency: config.depName },
        `${results.length} result(s): ${results.map(
          upgrade => upgrade.newVersion
        )}`
      );
    }
  } else {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: 'Failed to look up dependency',
    };
    if (config.yarnLock || config.packageLock) {
      result.message +=
        '. This will block *all* dependencies from being updated due to presence of lock file.';
    }
    results = [result];
    logger.info({ dependency: config.depName }, result.message);
  }
  for (const result of results) {
    result.repositoryUrl =
      npmDep && npmDep.repositoryUrl && npmDep.repositoryUrl.length
        ? npmDep.repositoryUrl
        : null;
    if (!result.repositoryUrl && config.depName.startsWith('@types/')) {
      logger.debug('Setting @types url manually');
      result.repositoryUrl = `https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/${config.depName.replace(
        '@',
        ''
      )}`;
    }
  }
  return results;
}
