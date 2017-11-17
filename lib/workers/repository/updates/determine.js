const packageFileWorker = require('../../package-file');
const { mergeChildConfig, filterConfig } = require('../../../config');
const { detectSemanticCommits } = require('./semantic');

async function determineRepoUpgrades(config) {
  logger.debug('determineRepoUpgrades()');
  logger.trace({ config });
  let upgrades = [];
  logger.debug(`Found ${config.packageFiles.length} package files`);
  // Iterate through repositories sequentially
  for (const packageFile of config.packageFiles) {
    logger.trace({ packageFile }, 'Getting packageFile config');
    let packageFileConfig = mergeChildConfig(config, packageFile);
    packageFileConfig = filterConfig(packageFileConfig, 'packageFile');
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
  let semanticCommits;
  if (upgrades.length) {
    semanticCommits = await detectSemanticCommits(config);
  }
  // Sanitize depNames
  upgrades = upgrades.map(upgrade => ({
    ...upgrade,
    semanticCommits,
    depNameSanitized: upgrade.depName
      ? upgrade.depName
          .replace('@', '')
          .replace('/', '-')
          .toLowerCase()
      : undefined,
  }));

  logger.debug('returning upgrades');
  return { ...config, upgrades };
}

module.exports = { determineRepoUpgrades };
