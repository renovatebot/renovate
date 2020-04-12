import is from '@sindresorhus/is';
import { File, platform } from '../../platform';
import { logger } from '../../logger';
import { get } from '../../manager';
import { ArtifactError } from '../../manager/common';
import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import * as datasourceGitSubmodules from '../../datasource/git-submodules';
import { doAutoReplace } from './auto-replace';
import { BranchConfig } from '../common';

export interface PackageFilesResult {
  artifactErrors: ArtifactError[];
  parentBranch?: string;
  updatedPackageFiles: File[];
  updatedArtifacts: File[];
}

export async function getUpdatedPackageFiles(
  config: BranchConfig
): Promise<PackageFilesResult> {
  logger.debug('manager.getUpdatedPackageFiles()');
  logger.trace({ config });
  const { parentBranch } = config;
  const updatedFileContents: Record<string, string> = {};
  const packageFileManagers: Record<string, string> = {};
  const packageFileUpdatedDeps: Record<string, string[]> = {};
  const lockFileMaintenanceFiles = [];
  for (const upgrade of config.upgrades) {
    const { autoReplace, manager, packageFile, depName } = upgrade;
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
        logger.debug('Rebasing branch after file not found');
        return getUpdatedPackageFiles({
          ...config,
          parentBranch: undefined,
        });
      }
      if (autoReplace) {
        logger.debug('autoReplace');
        const res = await doAutoReplace(upgrade, existingContent, parentBranch);
        if (res) {
          if (res === existingContent) {
            logger.debug('No content changed');
          } else {
            logger.debug('Contents updated');
            updatedFileContents[packageFile] = res;
          }
          continue; // eslint-disable-line no-continue
        } else if (parentBranch) {
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.error('Could not autoReplace');
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      const updateDependency = get(manager, 'updateDependency');
      const newContent = await updateDependency({
        fileContent: existingContent,
        upgrade,
      });
      if (!newContent) {
        if (config.parentBranch) {
          logger.debug('Rebasing branch after error updating content');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.debug(
          { existingContent, config: upgrade },
          'Error updating file'
        );
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      if (newContent !== existingContent) {
        if (config.parentBranch) {
          // This ensure it's always 1 commit from the bot
          logger.debug('Need to update package file so will rebase first');
          return getUpdatedPackageFiles({
            ...config,
            parentBranch: undefined,
          });
        }
        logger.debug('Updating packageFile content');
        updatedFileContents[packageFile] = newContent;
      }
      if (
        newContent === existingContent &&
        upgrade.datasource === datasourceGitSubmodules.id
      ) {
        updatedFileContents[packageFile] = newContent;
      }
    }
  }
  const updatedPackageFiles = Object.keys(updatedFileContents).map(name => ({
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
  if (!config.parentBranch) {
    // Only perform lock file maintenance if it's a fresh commit
    for (const packageFile of lockFileMaintenanceFiles) {
      const manager = packageFileManagers[packageFile];
      const updateArtifacts = get(manager, 'updateArtifacts');
      if (updateArtifacts) {
        const packageFileContents =
          updatedFileContents[packageFile] ||
          (await platform.getFile(packageFile, config.parentBranch));
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
    parentBranch: config.parentBranch, // Need to overwrite original config
    updatedPackageFiles,
    updatedArtifacts,
    artifactErrors,
  };
}
