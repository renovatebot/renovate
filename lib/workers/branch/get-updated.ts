import is from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import * as datasourceGitSubmodules from '../../datasource/git-submodules';
import { logger } from '../../logger';
import { get } from '../../manager';
import { ArtifactError } from '../../manager/common';
import { File, getFile } from '../../util/git';
import { BranchConfig } from '../common';
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
  const { branchName, reuseExistingBranch } = config;
  logger.debug(
    { reuseExistingBranch, branchName },
    'manager.getUpdatedPackageFiles()'
  );
  const updatedFileContents: Record<string, string> = {};
  const packageFileManagers: Record<string, string> = {};
  const packageFileUpdatedDeps: Record<string, string[]> = {};
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
      let existingContent = updatedFileContents[packageFile];
      if (!existingContent) {
        existingContent = await getFile(
          packageFile,
          reuseExistingBranch ? config.branchName : config.baseBranch
        );
      }
      // istanbul ignore if
      if (config.reuseExistingBranch && !existingContent) {
        logger.debug(
          { packageFile, depName },
          'Rebasing branch after file not found'
        );
        return getUpdatedPackageFiles({
          ...config,
          reuseExistingBranch: false,
        });
      }
      const updateDependency = get(manager, 'updateDependency');
      if (!updateDependency) {
        const res = await doAutoReplace(
          upgrade,
          existingContent,
          reuseExistingBranch
        );
        if (res) {
          if (res === existingContent) {
            logger.debug({ packageFile, depName }, 'No content changed');
            if (
              upgrade.currentValue === upgrade.newValue &&
              upgrade.rangeStrategy === 'update-lockfile'
            ) {
              logger.debug({ packageFile, depName }, 'update-lockfile add');
              updatedFileContents[packageFile] = res;
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
      const newContent = await updateDependency({
        fileContent: existingContent,
        upgrade,
      });
      if (!newContent) {
        if (config.reuseExistingBranch) {
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
          { existingContent, config: upgrade },
          'Error updating file'
        );
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      if (newContent !== existingContent) {
        if (config.reuseExistingBranch) {
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
        logger.debug({ packageFile, depName }, 'Updating packageFile content');
        updatedFileContents[packageFile] = newContent;
      }
      if (newContent === existingContent) {
        if (upgrade.datasource === datasourceGitSubmodules.id) {
          updatedFileContents[packageFile] = newContent;
        }
        // istanbul ignore next
        if (
          upgrade.rangeStrategy === 'update-lockfile' &&
          upgrade.currentValue === upgrade.newValue
        ) {
          // Treat the file as modified because we need to update artifacts
          updatedFileContents[packageFile] = newContent;
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
  if (!config.reuseExistingBranch) {
    // Only perform lock file maintenance if it's a fresh commit
    for (const packageFile of lockFileMaintenanceFiles) {
      const manager = packageFileManagers[packageFile];
      const updateArtifacts = get(manager, 'updateArtifacts');
      if (updateArtifacts) {
        const packageFileContents =
          updatedFileContents[packageFile] ||
          (await getFile(
            packageFile,
            config.reuseExistingBranch ? config.branchName : config.baseBranch
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
    reuseExistingBranch: config.reuseExistingBranch, // Need to overwrite original config
    updatedPackageFiles,
    updatedArtifacts,
    artifactErrors,
  };
}
