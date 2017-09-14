const packageJsonHelper = require('./package-json');
const packageJsHelper = require('./package-js');

module.exports = {
  getUpdatedPackageFiles,
};

async function getUpdatedPackageFiles(config) {
  const { logger } = config;
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await config.api.getFileContent(
          upgrade.packageFile,
          config.parentBranch
        ));
      let newContent;
      if (upgrade.packageFile.endsWith('package.json')) {
        newContent = packageJsonHelper.setNewValue(
          existingContent,
          upgrade.depType,
          upgrade.depName,
          upgrade.newVersion,
          config.logger
        );
      } else {
        newContent = packageJsHelper.setNewValue(
          existingContent,
          upgrade.depName,
          upgrade.currentVersion,
          upgrade.newVersion,
          config.logger
        );
      }
      if (newContent !== existingContent) {
        logger.debug('Updating packageFile content');
        updatedPackageFiles[upgrade.packageFile] = newContent;
      }
    }
  }

  return Object.keys(updatedPackageFiles).map(packageFile => ({
    name: packageFile,
    contents: updatedPackageFiles[packageFile],
  }));
}
