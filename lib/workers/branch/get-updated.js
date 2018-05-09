const { get } = require('../../manager');

module.exports = {
  getUpdatedPackageFiles,
};

async function getUpdatedPackageFiles(config) {
  logger.debug('manager.getUpdatedPackageFiles()');
  logger.trace({ config });
  const updatedPackageFiles = {};

  for (const upgrade of config.upgrades) {
    const { manager } = upgrade;
    if (upgrade.type !== 'lockFileMaintenance') {
      const existingContent =
        updatedPackageFiles[upgrade.packageFile] ||
        (await platform.getFile(upgrade.packageFile, config.parentBranch));
      let newContent = existingContent;
      const updateDependency = get(manager, 'updateDependency');
      newContent = await updateDependency(existingContent, upgrade);
      if (!newContent) {
        if (config.parentBranch) {
          logger.info('Rebasing branch after error updating content');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        throw new Error('Error updating branch content and cannot rebase');
      }
      if (newContent !== existingContent) {
        if (config.parentBranch) {
          // This ensure it's always 1 commit from Renovate
          logger.info('Need to update package file so will rebase first');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.debug('Updating packageFile content');
        updatedPackageFiles[upgrade.packageFile] = newContent;
      }
    }
  }
  return {
    parentBranch: config.parentBranch, // Need to overwrite original config
    updatedPackageFiles: Object.keys(updatedPackageFiles).map(packageFile => ({
      name: packageFile,
      contents: updatedPackageFiles[packageFile],
    })),
  };
}
