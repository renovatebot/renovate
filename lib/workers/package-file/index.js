const path = require('path');
const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const configMigration = require('../../config/migration');
const configValidation = require('../../config/validation');

let logger = require('../../logger');

module.exports = {
  renovatePackageFile,
};

async function renovatePackageFile(packageFileConfig) {
  let config = Object.assign({}, packageFileConfig);
  let upgrades = [];
  logger = config.logger;
  logger.info(`Processing package file`);
  // If onboarding, use the package.json in onboarding branch unless a custom base branch was defined
  const packageContent = await config.api.getFileJson(
    config.packageFile,
    config.contentBaseBranch
  );

  if (!packageContent) {
    config.depName = config.packageFile;
    config.type = 'error';
    config.message = 'No json content found';
    logger.warn(config.message);
    return [config];
  }

  // Check for renovate config inside the package.json
  if (packageContent.renovate) {
    logger.trace(
      { config: packageContent.renovate },
      'package.json>renovate config'
    );
    const { isMigrated, migratedConfig } = configMigration.migrateConfig(
      packageContent.renovate
    );
    if (isMigrated) {
      config.logger.info(
        { oldConfig: packageContent.renovate, newConfig: migratedConfig },
        'Config migration necessary'
      );
    } else {
      config.logger.debug('No config migration necessary');
    }
    const { warnings, errors } = configValidation.validateConfig(
      migratedConfig
    );
    // istanbul ignore if
    if (warnings.length) {
      logger.debug(
        { warnings },
        'Found package.json>renovate configuration warnings'
      );
    }
    if (errors.length) {
      logger.warn(
        { errors },
        'Found package.json>renovate configuration errors'
      );
      /* TODO #556
      errors.forEach(error => {
        upgrades.push(
          Object.assign({}, error, {
            depName: `${config.packageFile}(renovate)`,
            type: 'error',
          })
        );
      });
      */
    }
    // package.json>renovate config takes precedence over existing config
    config = configParser.mergeChildConfig(config, migratedConfig);
  } else {
    logger.debug('Package file has no renovate configuration');
  }
  // Now check if config is disabled
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
    const depTypeConfig = configParser.mergeChildConfig(
      config,
      config[depType]
    );
    depTypeConfig.depType = depType;
    depTypeConfig.logger = logger.child({
      repository: depTypeConfig.repository,
      packageFile: depTypeConfig.packageFile,
      depType: depTypeConfig.depType,
    });
    logger.debug({ config: depTypeConfig }, 'depTypeConfig');
    return configParser.filterConfig(depTypeConfig, 'depType');
  });
  logger.trace({ config: depTypeConfigs }, `depTypeConfigs`);
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.renovateDepType(packageContent, depTypeConfig)
    );
  }

  // Detect if a yarn.lock file is in use
  const yarnLockFileName = path.join(
    path.dirname(config.packageFile),
    'yarn.lock'
  );
  if (await config.api.getFileContent(yarnLockFileName)) {
    config.hasYarnLock = true;
  }
  const packageLockFileName = path.join(
    path.dirname(config.packageFile),
    'package-lock.json'
  );
  if (await config.api.getFileContent(packageLockFileName)) {
    config.hasPackageLock = true;
  }
  if (
    config.lockFileMaintenance.enabled &&
    (config.hasYarnLock || config.hasPackageLock)
  ) {
    logger.debug('lockFileMaintenance enabled');
    // Maintain lock files
    const lockFileMaintenanceConf = configParser.mergeChildConfig(
      config,
      config.lockFileMaintenance
    );
    lockFileMaintenanceConf.type = 'lockFileMaintenance';
    logger.debug(
      { config: lockFileMaintenanceConf },
      `lockFileMaintenanceConf`
    );
    upgrades.push(lockFileMaintenanceConf);
  }

  logger.info('Finished processing package file');
  return upgrades;
}
