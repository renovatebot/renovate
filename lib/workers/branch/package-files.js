const packageJsonHelper = require('./package-json');

module.exports = {
  getUpdatedPackageFiles,
};

async function getUpdatedPackageFiles(config) {
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await config.api.getFileContent(
          upgrade.packageFile,
          config.parentBranch
        ));
      const newContent = packageJsonHelper.setNewValue(
        existingContent,
        upgrade.depType,
        upgrade.depName,
        upgrade.newVersion,
        config.logger
      );
      if (newContent !== existingContent) {
        config.logger.debug('Updating packageFile content');
        updatedPackageFiles[upgrade.packageFile] = newContent;
      }
    }
  }

  return Object.keys(updatedPackageFiles).map(packageFile => ({
    name: packageFile,
    contents: updatedPackageFiles[packageFile],
  }));
}
