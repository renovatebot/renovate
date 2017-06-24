// Workers
const packageFileWorker = require('../package-file');

module.exports = determineRepoUpgrades;

async function determineRepoUpgrades(config) {
  config.logger.trace({ config }, 'determineRepoUpgrades');
  let upgrades = [];
  for (let packageFile of config.packageFiles) {
    if (typeof packageFile === 'string') {
      packageFile = { packageFile };
    } else if (packageFile.fileName) {
      // Retained deprecated 'fileName' for backwards compatibility
      // TODO: Remove in renovate 9
      packageFile.packageFile = packageFile.fileName;
      delete packageFile.fileName;
    }
    const packageFileConfig = Object.assign({}, config, packageFile);
    delete packageFileConfig.packageFiles;
    upgrades = upgrades.concat(
      await packageFileWorker.processPackageFile(packageFileConfig)
    );
  }
  return upgrades;
}
