import is from '@sindresorhus/is';

const { logger } = require('../../logger');
const { get } = require('../../manager');

export { getUpdatedPackageFiles };

async function getUpdatedPackageFiles(config) {
  logger.debug('manager.getUpdatedPackageFiles()');
  logger.trace({ config });
  const updatedFileContents = {};
  const packageFileManagers = {};
  const packageFileUpdatedDeps = {};
  const lockFileMaintenanceFiles = [];
  for (const upgrade of config.upgrades) {
    const { manager, packageFile, depName } = upgrade;
    packageFileManagers[packageFile] = manager;
    packageFileUpdatedDeps[packageFile] =
      packageFileUpdatedDeps[packageFile] || [];
    packageFileUpdatedDeps[packageFile].push(depName);
    if (upgrade.updateType === 'lockFileMaintenance') {
      lockFileMaintenanceFiles.push(packageFile);
    } else {
      const existingContent =
        updatedFileContents[packageFile] ||
        (await platform.getFile(packageFile, config.parentBranch));
      // istanbul ignore if
      if (config.parentBranch && !existingContent) {
        logger.info('Rebasing branch after file not found');
        return getUpdatedPackageFiles({
          ...config,
          parentBranch: undefined,
        });
      }
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
        logger.debug(
          { existingContent, config: upgrade },
          'Error updating file'
        );
        throw new Error('update-failure');
      }
      if (newContent !== existingContent) {
        if (config.parentBranch) {
          // This ensure it's always 1 commit from the bot
          logger.info('Need to update package file so will rebase first');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.debug('Updating packageFile content');
        updatedFileContents[packageFile] = newContent;
      }
    }
  }
  const updatedPackageFiles = Object.keys(updatedFileContents).map(name => ({
    name,
    contents: updatedFileContents[name],
  }));
  const updatedArtifacts = [];
  const artifactErrors = [];
  for (const packageFile of updatedPackageFiles) {
    const manager = packageFileManagers[packageFile.name];
    const updatedDeps = packageFileUpdatedDeps[packageFile.name];
    const updateArtifacts = get(manager, 'updateArtifacts');
    if (updateArtifacts) {
      const results = await updateArtifacts(
        packageFile.name,
        updatedDeps,
        packageFile.contents,
        config
      );
      if (is.nonEmptyArray(results)) {
        for (/** @type any */ const res of results) {
          const { file, artifactError } = res;
          if (file) {
            updatedArtifacts.push(file);
          } else if (artifactError) {
            artifactErrors.push(artifactError);
          }
        }
      }
    }
  }
  if (!config.parentBranch) {
    // Only perform lock file maintenance if it's a fresh commit
    for (const packageFile of lockFileMaintenanceFiles) {
      const manager = packageFileManagers[packageFile];
      const updateArtifacts = get(manager, 'updateArtifacts');
      if (updateArtifacts) {
        const packageFileContents =
          updatedFileContents[packageFile] ||
          (await platform.getFile(packageFile, config.parentBranch));
        const results = await updateArtifacts(
          packageFile,
          [],
          packageFileContents,
          config
        );
        if (is.nonEmptyArray(results)) {
          for (/** @type any */ const res of results) {
            const { file, artifactError } = res;
            if (file) {
              updatedArtifacts.push(file);
            } else if (artifactError) {
              artifactErrors.push(artifactError);
            }
          }
        }
      }
    }
  }
  return {
    parentBranch: config.parentBranch, // Need to overwrite original config
    updatedPackageFiles,
    updatedArtifacts,
    artifactErrors,
  };
}
