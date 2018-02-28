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
    logger.setMeta({
      repository: config.repository,
      packageFile: packageFile.packageFile,
    });
    logger.debug('Getting packageFile config');
    logger.trace({ fullPackageFile: packageFile });
    let packageFileConfig = mergeChildConfig(config, packageFile);
    packageFileConfig = filterConfig(packageFileConfig, 'packageFile');
    const { manager } = packageFileConfig;
    if (manager === 'npm') {
      logger.info(
        { packageFile: packageFileConfig.packageFile },
        'Renovating package.json dependencies'
      );
      upgrades = upgrades.concat(
        await packageFileWorker.renovatePackageFile(packageFileConfig)
      );
    } else if (manager === 'meteor') {
      logger.info('Renovating package.js (meteor) dependencies');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateMeteorPackageFile(packageFileConfig)
      );
    } else if (manager === 'docker') {
      logger.info('Renovating Dockerfile FROM');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateDockerfile(packageFileConfig)
      );
    } else if (manager === 'node') {
      logger.info('Renovating .travis.yml node_js versions');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateNodeFile(packageFileConfig)
      );
    } else if (manager === 'bazel') {
      logger.info('Renovating bazel WORKSPACE dependencies');
      upgrades = upgrades.concat(
        await packageFileWorker.renovateBazelFile(packageFileConfig)
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
          .replace('@types/', '')
          .replace('@', '')
          .replace('/', '-')
          .replace(/\s+/g, '-')
          .toLowerCase()
      : undefined,
  }));

  logger.debug('returning upgrades');
  return { ...config, upgrades };
}

module.exports = { determineRepoUpgrades };
