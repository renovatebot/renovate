const yarnLockParser = require('@yarnpkg/lockfile');
const configParser = require('../../config');
const depTypeWorker = require('../dep-type');
const npmApi = require('../../datasource/npm');
const upath = require('upath');

module.exports = {
  mightBeABrowserLibrary,
  renovatePackageFile,
  renovatePackageJson,
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

async function renovatePackageFile(config) {
  logger.setMeta({
    repository: config.repository,
    packageFile: config.packageFile,
  });
  logger.debug('renovatePackageFile()');
  const { manager } = config;
  if (config.enabled === false) {
    logger.info('packageFile is disabled');
    return [];
  }
  if (manager === 'npm') {
    return renovatePackageJson(config);
  }
  const content = await platform.getFile(config.packageFile);
  return depTypeWorker.renovateDepType(content, config);
}

async function renovatePackageJson(input) {
  const config = { ...input };
  if (config.npmrc) {
    logger.debug('Setting .npmrc');
    npmApi.setNpmrc(
      config.npmrc,
      config.global ? config.global.exposeEnv : false
    );
  }
  let upgrades = [];
  logger.info(`Processing package file`);

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
      config.yarnLockParsed = yarnLockParser.parse(
        await platform.getFile(yarnLock)
      );
      if (config.yarnLockParsed.type !== 'success') {
        logger.info(
          { type: config.yarnLockParsed.type },
          'Error parsing yarn.lock - not success'
        );
        delete config.yarnLockParsed;
      }
      logger.trace({ yarnLockParsed: config.yarnLockParsed });
    } catch (err) {
      logger.info({ yarnLock }, 'Warning: Exception parsing yarn.lock');
    }
  } else if (config.packageLock) {
    try {
      config.packageLockParsed = JSON.parse(
        await platform.getFile(config.packageLock)
      );
      logger.trace({ packageLockParsed: config.packageLockParsed });
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
    'engines',
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
      !depTypeConfig.upgradeInRange &&
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
      await depTypeWorker.renovateDepType(config.content, depTypeConfig)
    );
  }
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
