const packageFileWorker = require('../../package-file');
const { mergeChildConfig, filterConfig } = require('../../../config');

async function determineRepoUpgrades(config) {
  const { logger } = config;
  logger.debug('determineRepoUpgrades()');
  logger.trace({ config });
  let upgrades = [];
  logger.debug(`Found ${config.packageFiles.length} package files`);
  // Iterate through repositories sequentially
  for (const packageFile of config.packageFiles) {
    logger.debug({ packageFile }, 'Getting packageFile config');
    let packageFileConfig = mergeChildConfig(config, packageFile);
    packageFileConfig = filterConfig(packageFileConfig, 'packageFile');
    packageFileConfig.logger = packageFileConfig.logger.child({
      repository: packageFileConfig.repository,
      packageFile: packageFileConfig.packageFile,
    });
    if (packageFileConfig.packageFile.endsWith('package.json')) {
      logger.info(
        { packageFile: packageFileConfig.packageFile },
        'Renovating package.json dependencies'
      );
      upgrades = upgrades.concat(
        await packageFileWorker.renovatePackageFile(packageFileConfig)
      );
    } else if (packageFileConfig.packageFile.endsWith('package.js')) {
      logger.info('Renovating package.js (meteor) dependencies');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateMeteorPackageFile(packageFileConfig)
      );
    } else if (packageFileConfig.packageFile.endsWith('Dockerfile')) {
      logger.info('Renovating Dockerfile FROM');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateDockerfile(packageFileConfig)
      );
    }
  }
  // Sanitize depNames
  upgrades = upgrades.map(upgrade => ({
    ...upgrade,
    depNameSanitized: upgrade.depName
      ? upgrade.depName
          .replace('@', '')
          .replace('/', '-')
          .toLowerCase()
      : undefined,
  }));
  return { ...config, upgrades };
}

module.exports = { determineRepoUpgrades };
