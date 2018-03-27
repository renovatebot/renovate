const npmApi = require('../../datasource/npm');
const versions = require('../../workers/package/versions');
const nodeManager = require('../_helpers/node/package');

module.exports = {
  getPackageUpdates,
};

async function getPackageUpdates(config) {
  logger.debug({ dependency: config.depName }, `npm.getPackageUpdates()`);
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
  } else if (config.updateLockFiles && config.yarnLock) {
    if (config.repoIsOnboarded) {
      // Config error
      const error = new Error('config-validation');
      error.configFile = config.packageFile;
      error.validationError = `Failed to look up npm dependency \`${
        config.depName
      }\``;
      error.validationMessage =
        'This dependency lookup failure will cause all lock file updates to fail. Please either remove the dependency, or remove the lock file, or add npm authentication, or set `updateLockFiles` to false in your config.';
      throw error;
    } else {
      // If dependency lookup fails then error and return
      const result = {
        type: 'error',
        message: `Failed to look up dependency ${
          config.depName
        }. This will prevent yarn.lock from being updated.`,
      };
      results = [result];
      logger.info({ dependency: config.depName }, result.message);
    }
  } else {
    // If dependency lookup fails then warn and return
    const result = {
      type: 'warning',
      message: `Failed to look up dependency ${config.depName}`,
    };
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
