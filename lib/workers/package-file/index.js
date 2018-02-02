const yarnLockParser = require('@yarnpkg/lockfile');
const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const npmApi = require('../../manager/npm/registry');
const upath = require('upath');

module.exports = {
  mightBeABrowserLibrary,
  renovatePackageFile,
  renovateMeteorPackageFile,
  renovateDockerfile,
  renovateNodeFile,
  renovateBazelFile,
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
    logger.debug('Setting .npmrc');
    npmApi.setNpmrc(
      config.npmrc,
      config.global ? config.global.exposeEnv : false
    );
  }
  let upgrades = [];
  logger.info(`Processing package file`);

  // Check if config is disabled
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return upgrades;
  }

  let yarnLockParsed;
  let packageLockParsed;
  let { yarnLock } = config;
  if (!yarnLock && config.workspaceDir) {
    yarnLock = upath.join(config.workspaceDir, 'yarn.lock');
    if (await platform.getFile(yarnLock)) {
      logger.debug({ yarnLock }, 'Using workspaces yarn.lock');
    } else {
      logger.debug('Yarn workspaces has no yarn.lock');
      yarnLock = undefined;
    }
  }
  if (yarnLock) {
    try {
      yarnLockParsed = yarnLockParser.parse(await platform.getFile(yarnLock));
      if (yarnLockParsed.type !== 'success') {
        logger.info(
          { type: yarnLockParsed.type },
          'Error parsing yarn.lock - not success'
        );
        yarnLockParsed = undefined;
      }
      logger.trace({ yarnLockParsed });
    } catch (err) {
      logger.info({ yarnLock }, 'Warning: Exception parsing yarn.lock');
    }
  } else if (config.packageLock) {
    try {
      packageLockParsed = JSON.parse(
        await platform.getFile(config.packageLock)
      );
      logger.trace({ packageLockParsed });
    } catch (err) {
      logger.warn(
        { packageLock: config.packageLock },
        'Could not parse package-lock.json'
      );
    }
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
      logger.debug({ depType }, 'Autodetecting pinVersions = true');
      depTypeConfig.pinVersions = true;
    }
    logger.trace({ config: depTypeConfig }, 'depTypeConfig');
    return configParser.filterConfig(depTypeConfig, 'depType');
  });
  logger.trace({ config: depTypeConfigs }, `depTypeConfigs`);
  for (const depTypeConfig of depTypeConfigs) {
    upgrades = upgrades.concat(
      await depTypeWorker.renovateDepType(
        config.content,
        depTypeConfig,
        packageLockParsed,
        yarnLockParsed
      )
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
  const content = await platform.getFile(packageFileConfig.packageFile);
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

async function renovateNodeFile(packageFileConfig) {
  let upgrades = [];
  logger.info(`Processing node file`);

  // Check if config is disabled
  if (packageFileConfig.enabled === false) {
    logger.info('node is disabled');
    return upgrades;
  }
  upgrades = upgrades.concat(
    await depTypeWorker.renovateDepType(
      packageFileConfig.content,
      packageFileConfig
    )
  );
  logger.info('Finished processing node file');
  return upgrades;
}

async function renovateBazelFile(packageFileConfig) {
  let upgrades = [];
  logger.info(`Processing bazel WORKSPACE file`);

  // Check if config is disabled
  if (packageFileConfig.enabled === false) {
    logger.info('bazel is disabled');
    return upgrades;
  }
  upgrades = upgrades.concat(
    await depTypeWorker.renovateDepType(
      packageFileConfig.content,
      packageFileConfig
    )
  );
  logger.info('Finished processing bazel file');
  return upgrades;
}
