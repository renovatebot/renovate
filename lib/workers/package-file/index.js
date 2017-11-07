const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const npmApi = require('../../manager/npm/registry');

module.exports = {
  mightBeABrowserLibrary,
  renovatePackageFile,
  renovateMeteorPackageFile,
  renovateDockerfile,
};

function mightBeABrowserLibrary(packageJson) {
  // return true unless we're sure it's not a browser library
  if (packageJson.private === true) {
    // it's not published
    return false;
  }
  if (packageJson.main === undefined) {
    // it can't be required
    return false;
  }
  // TODO: how can we know if it's a node.js library only, and not browser?
  // Otherwise play it safe and return true
  return true;
}

async function renovatePackageFile(packageFileConfig) {
  const config = { ...packageFileConfig };
  logger.setMeta({
    repository: config.repository,
    packageFile: config.packageFile,
  });
  logger.debug('renovatePakageFile()');
  if (config.npmrc) {
    npmApi.setNpmrc(config.npmrc);
  }
  let upgrades = [];
  logger.info(`Processing package file`);

  // Check if config is disabled
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return upgrades;
  }

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  const depTypeConfigs = depTypes.map(depType => {
    const depTypeConfig = configParser.mergeChildConfig(config, {
      ...config[depType],
    });
    depTypeConfig.depType = depType;
    // Always pin devDependencies
    // Pin dependencies if we're pretty sure it's not a browser library
    if (
      depTypeConfig.pinVersions === null &&
      (depType === 'devDependencies' ||
        (depType === 'dependencies' && !mightBeABrowserLibrary(config.content)))
    ) {
      logger.debug('Autodetecting pinVersions = true');
      depTypeConfig.pinVersions = true;
    }
    logger.trace({ config: depTypeConfig }, 'depTypeConfig');
    return configParser.filterConfig(depTypeConfig, 'depType');
  });
  logger.trace({ config: depTypeConfigs }, `depTypeConfigs`);
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.renovateDepType(config.content, depTypeConfig)
    );
  }
  // Reset logger again
  logger.setMeta({
    repository: config.repository,
    packageFile: config.packageFile,
  });
  if (
    config.lockFileMaintenance.enabled &&
    (config.yarnLock || config.packageLock)
  ) {
    logger.debug('lockFileMaintenance enabled');
    // Maintain lock files
    const lockFileMaintenanceConf = configParser.mergeChildConfig(
      config,
      config.lockFileMaintenance
    );
    lockFileMaintenanceConf.type = 'lockFileMaintenance';
    logger.trace(
      { config: lockFileMaintenanceConf },
      `lockFileMaintenanceConf`
    );
    upgrades.push(configParser.filterConfig(lockFileMaintenanceConf, 'branch'));
  }

  logger.info('Finished processing package file');
  return upgrades;
}

async function renovateMeteorPackageFile(packageFileConfig) {
  const config = { ...packageFileConfig };
  let upgrades = [];
  logger.info(`Processing meteor package file`);

  // Check if config is disabled
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return upgrades;
  }
  const content = await platform.getFileContent(packageFileConfig.packageFile);
  upgrades = upgrades.concat(
    await depTypeWorker.renovateDepType(content, packageFileConfig)
  );
  logger.info('Finished processing package file');
  return upgrades;
}

async function renovateDockerfile(packageFileConfig) {
  let upgrades = [];
  logger.info(`Processing Dockerfile`);

  // Check if config is disabled
  if (packageFileConfig.enabled === false) {
    logger.info('Dockerfile is disabled');
    return upgrades;
  }
  upgrades = upgrades.concat(
    await depTypeWorker.renovateDepType(
      packageFileConfig.content,
      packageFileConfig
    )
  );
  logger.info('Finished processing Dockerfile');
  return upgrades;
}
