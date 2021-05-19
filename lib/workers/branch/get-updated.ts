import is from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { get } from '../../manager';
import type { ArtifactError } from '../../manager/types';
import { File, getFile } from '../../util/git';
import type { BranchConfig } from '../types';
import { doAutoReplace } from './auto-replace';

export interface PackageFilesResult {
  artifactErrors: ArtifactError[];
  reuseExistingBranch?: boolean;
  updatedPackageFiles: File[];
  updatedArtifacts: File[];
}

export async function getUpdatedPackageFiles(
  config: BranchConfig
): Promise<PackageFilesResult> {
  logger.trace({ config });
  const { reuseExistingBranch } = config;
  logger.debug(
    `manager.getUpdatedPackageFiles() reuseExistinbranch=${reuseExistingBranch}`
  );
  let updatedFileContents: Record<string, string> = {};
  const nonUpdatedFileContents: Record<string, string> = {};
  const packageFileManagers: Record<string, string> = {};
  const packageFileUpdatedDeps: Record<string, string[]> = {};
  const lockFileMaintenanceFiles = [];
  for (const upgrade of config.upgrades) {
    const { manager, packageFile, lockFile, depName } = upgrade;
    packageFileManagers[packageFile] = manager;
    packageFileUpdatedDeps[packageFile] =
      packageFileUpdatedDeps[packageFile] || [];
    packageFileUpdatedDeps[packageFile].push(depName);
    let packageFileContent = updatedFileContents[packageFile];
    if (!packageFileContent) {
      packageFileContent = await getFile(
        packageFile,
        reuseExistingBranch ? config.branchName : config.baseBranch
      );
    }
    // istanbul ignore if
    if (reuseExistingBranch && !packageFileContent) {
      logger.debug(
        { packageFile, depName },
        'Rebasing branch after file not found'
      );
      return getUpdatedPackageFiles({
        ...config,
        reuseExistingBranch: false,
      });
    }
    if (upgrade.updateType === 'lockFileMaintenance') {
      lockFileMaintenanceFiles.push(packageFile);
    } else if (upgrade.isRemediation) {
      let lockFileContent = updatedFileContents[lockFile];
      if (!lockFileContent) {
        lockFileContent = await getFile(
          lockFile,
          reuseExistingBranch ? config.branchName : config.baseBranch
        );
      }
      // istanbul ignore if: to hard to test
      if (reuseExistingBranch && !lockFileContent) {
        logger.debug(
          { lockFile, depName },
          'Rebasing branch after lock file not found'
        );
        return getUpdatedPackageFiles({
          ...config,
          reuseExistingBranch: false,
        });
      }
      const updateLockedDependency = get(manager, 'updateLockedDependency');
      const files = await updateLockedDependency({
        ...upgrade,
        packageFileContent,
        lockFileContent,
      });
      if (files) {
        if (reuseExistingBranch) {
          // This ensure it's always 1 commit from the bot
          logger.debug(
            { lockFile, depName },
            'Need to update file(s) so will rebase first'
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        updatedFileContents = { ...updatedFileContents, ...files };
      }
    } else {
      const bumpPackageVersion = get(manager, 'bumpPackageVersion');
      const updateDependency = get(manager, 'updateDependency');
      if (!updateDependency) {
        let res = await doAutoReplace(
          upgrade,
          packageFileContent,
          reuseExistingBranch
        );
        if (res) {
          if (bumpPackageVersion && upgrade.bumpVersion) {
            const { bumpedContent } = await bumpPackageVersion(
              res,
              upgrade.packageFileVersion,
              upgrade.bumpVersion
            );
            res = bumpedContent;
          }
          if (res === packageFileContent) {
            logger.debug({ packageFile, depName }, 'No content changed');
            if (upgrade.rangeStrategy === 'update-lockfile') {
              logger.debug({ packageFile, depName }, 'update-lockfile add');
              nonUpdatedFileContents[packageFile] = res;
            }
          } else {
            logger.debug({ packageFile, depName }, 'Contents updated');
            updatedFileContents[packageFile] = res;
          }
          continue; // eslint-disable-line no-continue
        } else if (reuseExistingBranch) {
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.error({ packageFile, depName }, 'Could not autoReplace');
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      let newContent = await updateDependency({
        fileContent: packageFileContent,
        upgrade,
      });
      if (bumpPackageVersion && upgrade.bumpVersion) {
        const { bumpedContent } = await bumpPackageVersion(
          newContent,
          upgrade.packageFileVersion,
          upgrade.bumpVersion
        );
        newContent = bumpedContent;
      }
      if (!newContent) {
        if (reuseExistingBranch) {
          logger.debug(
            { packageFile, depName },
            'Rebasing branch after error updating content'
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(
          { existingContent: packageFileContent, config: upgrade },
          'Error updating file'
        );
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      if (newContent !== packageFileContent) {
        if (reuseExistingBranch) {
          // This ensure it's always 1 commit from the bot
          logger.debug(
            { packageFile, depName },
            'Need to update package file so will rebase first'
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(`Updating ${depName} in ${packageFile || lockFile}`);
        updatedFileContents[packageFile] = newContent;
      }
      if (newContent === packageFileContent) {
        // istanbul ignore else
        if (upgrade.manager === 'git-submodules') {
          updatedFileContents[packageFile] = newContent;
        } else if (upgrade.rangeStrategy === 'update-lockfile') {
          nonUpdatedFileContents[packageFile] = newContent;
        }
      }
    }
  }
  const updatedPackageFiles = Object.keys(updatedFileContents).map((name) => ({
    name,
    contents: updatedFileContents[name],
  }));
  const updatedArtifacts: File[] = [];
  const artifactErrors: ArtifactError[] = [];
  for (const packageFile of updatedPackageFiles) {
    const manager = packageFileManagers[packageFile.name];
    const updatedDeps = packageFileUpdatedDeps[packageFile.name];
    const updateArtifacts = get(manager, 'updateArtifacts');
    if (updateArtifacts) {
      const results = await updateArtifacts({
        packageFileName: packageFile.name,
        updatedDeps,
        newPackageFileContent: packageFile.contents,
        config,
      });
      if (is.nonEmptyArray(results)) {
        for (const res of results) {
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
  const nonUpdatedPackageFiles = Object.keys(nonUpdatedFileContents).map(
    (name) => ({
      name,
      contents: nonUpdatedFileContents[name],
    })
  );
  for (const packageFile of nonUpdatedPackageFiles) {
    const manager = packageFileManagers[packageFile.name];
    const updatedDeps = packageFileUpdatedDeps[packageFile.name];
    const updateArtifacts = get(manager, 'updateArtifacts');
    if (updateArtifacts) {
      const results = await updateArtifacts({
        packageFileName: packageFile.name,
        updatedDeps,
        newPackageFileContent: packageFile.contents,
        config,
      });
      if (is.nonEmptyArray(results)) {
        updatedPackageFiles.push(packageFile);
        for (const res of results) {
          const { file, artifactError } = res;
          // istanbul ignore else
          if (file) {
            updatedArtifacts.push(file);
          } else if (artifactError) {
            artifactErrors.push(artifactError);
          }
        }
      }
    }
  }
  if (!reuseExistingBranch) {
    // Only perform lock file maintenance if it's a fresh commit
    for (const packageFile of lockFileMaintenanceFiles) {
      const manager = packageFileManagers[packageFile];
      const updateArtifacts = get(manager, 'updateArtifacts');
      if (updateArtifacts) {
        const packageFileContents =
          updatedFileContents[packageFile] ||
          (await getFile(
            packageFile,
            reuseExistingBranch ? config.branchName : config.baseBranch
          ));
        const results = await updateArtifacts({
          packageFileName: packageFile,
          updatedDeps: [],
          newPackageFileContent: packageFileContents,
          config,
        });
        if (is.nonEmptyArray(results)) {
          for (const res of results) {
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
    reuseExistingBranch, // Need to overwrite original config
    updatedPackageFiles,
    updatedArtifacts,
    artifactErrors,
  };
}
