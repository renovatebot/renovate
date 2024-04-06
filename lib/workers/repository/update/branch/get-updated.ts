/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import is from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { get } from '../../../../modules/manager';
import type {
  ArtifactError,
  PackageDependency,
  PackageFile,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../../../../modules/manager/types';
import { getFile } from '../../../../util/git';
import type { FileAddition, FileChange } from '../../../../util/git/types';
import { coerceString } from '../../../../util/string';
import type { BranchConfig } from '../../../types';
import { doAutoReplace } from './auto-replace';

export interface PackageFilesResult {
  artifactErrors: ArtifactError[];
  reuseExistingBranch?: boolean;
  updatedPackageFiles: FileChange[];
  updatedArtifacts: FileChange[];
}

async function getFileContent(
  updatedFileContents: Record<string, string>,
  filePath: string,
  config: BranchConfig,
): Promise<string | null> {
  let fileContent: string | null = updatedFileContents[filePath];
  if (!fileContent) {
    fileContent = await getFile(
      filePath,
      config.reuseExistingBranch ? config.branchName : config.baseBranch,
    );
  }
  return fileContent;
}

export async function getUpdatedPackageFiles(
  config: BranchConfig,
): Promise<PackageFilesResult> {
  logger.trace({ config });
  const reuseExistingBranch = config.reuseExistingBranch!;
  logger.debug(
    `manager.getUpdatedPackageFiles() reuseExistingBranch=${reuseExistingBranch}`,
  );
  let updatedFileContents: Record<string, string> = {};
  const nonUpdatedFileContents: Record<string, string> = {};
  const packageFileManagers: Record<string, Set<string>> = {};
  const packageFileUpdatedDeps: Record<string, PackageDependency[]> = {};
  const lockFileMaintenanceFiles = [];
  let firstUpdate = true;
  for (const upgrade of config.upgrades) {
    const manager = upgrade.manager!;
    const packageFile = upgrade.packageFile!;
    const depName = upgrade.depName!;
    // TODO: fix types, can be undefined (#22198)
    const newVersion = upgrade.newVersion!;
    const currentVersion = upgrade.currentVersion!;
    const updateLockedDependency = get(manager, 'updateLockedDependency')!;
    packageFileManagers[packageFile] ??= new Set<string>();
    packageFileManagers[packageFile].add(manager);
    packageFileUpdatedDeps[packageFile] ??= [];
    packageFileUpdatedDeps[packageFile].push({ ...upgrade });
    const packageFileContent = await getFileContent(
      updatedFileContents,
      packageFile,
      config,
    );
    let lockFileContent: string | null = null;
    const lockFile = upgrade.lockFile ?? upgrade.lockFiles?.[0] ?? '';
    if (lockFile) {
      lockFileContent = await getFileContent(
        updatedFileContents,
        lockFile,
        config,
      );
    }
    // istanbul ignore if
    if (
      reuseExistingBranch &&
      (!packageFileContent || (lockFile && !lockFileContent))
    ) {
      logger.debug(
        { packageFile, depName },
        'Rebasing branch after file not found',
      );
      return getUpdatedPackageFiles({
        ...config,
        reuseExistingBranch: false,
      });
    }
    if (upgrade.updateType === 'lockFileMaintenance') {
      lockFileMaintenanceFiles.push(packageFile);
    } else if (upgrade.isRemediation) {
      const { status, files } = await updateLockedDependency({
        ...upgrade,
        depName,
        newVersion,
        currentVersion,
        packageFile,
        packageFileContent: packageFileContent!,
        lockFile,
        lockFileContent: lockFileContent!,
        allowParentUpdates: true,
        allowHigherOrRemoved: true,
      });
      if (reuseExistingBranch && status !== 'already-updated') {
        logger.debug(
          { lockFile, depName, status },
          'Need to retry branch as it is not already up-to-date',
        );
        return getUpdatedPackageFiles({
          ...config,
          reuseExistingBranch: false,
        });
      }
      if (files) {
        updatedFileContents = { ...updatedFileContents, ...files };
        Object.keys(files).forEach(
          (file) => delete nonUpdatedFileContents[file],
        );
      }
      if (status === 'update-failed' || status === 'unsupported') {
        upgrade.remediationNotPossible = true;
      }
    } else if (upgrade.isLockfileUpdate) {
      if (updateLockedDependency) {
        const { status, files } = await updateLockedDependency({
          ...upgrade,
          depName,
          newVersion,
          currentVersion,
          packageFile,
          packageFileContent: packageFileContent!,
          lockFile,
          lockFileContent: lockFileContent!,
          allowParentUpdates: false,
        });
        if (status === 'unsupported') {
          // incompatible lock file
          if (!updatedFileContents[packageFile]) {
            nonUpdatedFileContents[packageFile] = packageFileContent!;
          }
        } else if (status === 'already-updated') {
          logger.debug(
            `Upgrade of ${depName} to ${newVersion} is already done in existing branch`,
          );
        } else {
          // something changed
          if (reuseExistingBranch) {
            logger.debug(
              { lockFile, depName, status },
              'Need to retry branch as upgrade requirements are not mets',
            );
            return getUpdatedPackageFiles({
              ...config,
              reuseExistingBranch: false,
            });
          }
          if (files) {
            updatedFileContents = { ...updatedFileContents, ...files };
            Object.keys(files).forEach(
              (file) => delete nonUpdatedFileContents[file],
            );
          }
        }
      } else {
        logger.debug(
          { manager },
          'isLockFileUpdate without updateLockedDependency',
        );
        if (!updatedFileContents[packageFile]) {
          nonUpdatedFileContents[packageFile] = packageFileContent!;
        }
      }
    } else {
      const bumpPackageVersion = get(manager, 'bumpPackageVersion');
      const updateDependency = get(manager, 'updateDependency');
      if (!updateDependency) {
        let res = await doAutoReplace(
          upgrade,
          packageFileContent!,
          reuseExistingBranch,
          firstUpdate,
        );
        firstUpdate = false;
        if (res) {
          if (
            bumpPackageVersion &&
            upgrade.bumpVersion &&
            upgrade.packageFileVersion
          ) {
            const { bumpedContent } = await bumpPackageVersion(
              res,
              upgrade.packageFileVersion,
              upgrade.bumpVersion,
              packageFile,
            );
            res = bumpedContent;
          }
          if (res === packageFileContent) {
            logger.debug({ packageFile, depName }, 'No content changed');
          } else {
            logger.debug({ packageFile, depName }, 'Contents updated');
            updatedFileContents[packageFile] = res!;
            delete nonUpdatedFileContents[packageFile];
          }
          continue;
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
        fileContent: packageFileContent!,
        upgrade,
      });
      if (
        newContent &&
        bumpPackageVersion &&
        upgrade.bumpVersion &&
        upgrade.packageFileVersion
      ) {
        const { bumpedContent } = await bumpPackageVersion(
          newContent,
          upgrade.packageFileVersion,
          upgrade.bumpVersion,
          packageFile,
        );
        newContent = bumpedContent;
      }
      if (!newContent) {
        if (reuseExistingBranch) {
          logger.debug(
            { packageFile, depName },
            'Rebasing branch after error updating content',
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(
          { existingContent: packageFileContent, config: upgrade },
          'Error updating file',
        );
        throw new Error(WORKER_FILE_UPDATE_FAILED);
      }
      if (newContent !== packageFileContent) {
        if (reuseExistingBranch) {
          // This ensure it's always 1 commit from the bot
          logger.debug(
            { packageFile, depName },
            'Need to update package file so will rebase first',
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(
          `Updating ${depName} in ${coerceString(packageFile, lockFile)}`,
        );
        updatedFileContents[packageFile] = newContent;
        delete nonUpdatedFileContents[packageFile];
      }
      if (newContent === packageFileContent) {
        if (upgrade.manager === 'git-submodules') {
          updatedFileContents[packageFile] = newContent;
          delete nonUpdatedFileContents[packageFile];
        }
      }
    }
  }
  const updatedPackageFiles: FileAddition[] = Object.keys(
    updatedFileContents,
  ).map((name) => ({
    type: 'addition',
    path: name,
    contents: updatedFileContents[name],
  }));
  const updatedArtifacts: FileChange[] = [];
  const artifactErrors: ArtifactError[] = [];
  // istanbul ignore if
  if (is.nonEmptyArray(updatedPackageFiles)) {
    logger.debug('updateArtifacts for updatedPackageFiles');
  }
  for (const packageFile of updatedPackageFiles) {
    const updatedDeps = packageFileUpdatedDeps[packageFile.path];
    const managers = packageFileManagers[packageFile.path];
    if (is.nonEmptySet(managers)) {
      for (const manager of managers) {
        const results = await managerUpdateArtifacts(manager, {
          packageFileName: packageFile.path,
          updatedDeps,
          // TODO #22198
          newPackageFileContent: packageFile.contents!.toString(),
          config: patchConfigForArtifactsUpdate(
            config,
            manager,
            packageFile.path,
          ),
        });
        processUpdateArtifactResults(results, updatedArtifacts, artifactErrors);
      }
    }
  }
  const nonUpdatedPackageFiles: FileAddition[] = Object.keys(
    nonUpdatedFileContents,
  ).map((name) => ({
    type: 'addition',
    path: name,
    contents: nonUpdatedFileContents[name],
  }));
  // istanbul ignore if
  if (is.nonEmptyArray(nonUpdatedPackageFiles)) {
    logger.debug('updateArtifacts for nonUpdatedPackageFiles');
  }
  for (const packageFile of nonUpdatedPackageFiles) {
    const updatedDeps = packageFileUpdatedDeps[packageFile.path];
    const managers = packageFileManagers[packageFile.path];
    if (is.nonEmptySet(managers)) {
      for (const manager of managers) {
        const results = await managerUpdateArtifacts(manager, {
          packageFileName: packageFile.path,
          updatedDeps,
          // TODO #22198
          newPackageFileContent: packageFile.contents!.toString(),
          config: patchConfigForArtifactsUpdate(
            config,
            manager,
            packageFile.path,
          ),
        });
        processUpdateArtifactResults(results, updatedArtifacts, artifactErrors);
        if (is.nonEmptyArray(results)) {
          updatedPackageFiles.push(packageFile);
        }
      }
    }
  }
  if (!reuseExistingBranch) {
    // Only perform lock file maintenance if it's a fresh commit
    // istanbul ignore if
    if (is.nonEmptyArray(lockFileMaintenanceFiles)) {
      logger.debug('updateArtifacts for lockFileMaintenanceFiles');
    }
    for (const packageFileName of lockFileMaintenanceFiles) {
      const managers = packageFileManagers[packageFileName];
      if (is.nonEmptySet(managers)) {
        for (const manager of managers) {
          const contents =
            updatedFileContents[packageFileName] ||
            (await getFile(packageFileName, config.baseBranch));
          const results = await managerUpdateArtifacts(manager, {
            packageFileName,
            updatedDeps: [],
            newPackageFileContent: contents!,
            config: patchConfigForArtifactsUpdate(
              config,
              manager,
              packageFileName,
            ),
          });
          processUpdateArtifactResults(
            results,
            updatedArtifacts,
            artifactErrors,
          );
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

// workaround, see #27319
function patchConfigForArtifactsUpdate(
  config: BranchConfig,
  manager: string,
  packageFileName: string,
): BranchConfig {
  const updatedConfig = { ...config };
  if (is.nonEmptyArray(updatedConfig.packageFiles?.[manager])) {
    const managerPackageFiles: PackageFile[] =
      updatedConfig.packageFiles?.[manager];
    const packageFile = managerPackageFiles.find(
      (p) => p.packageFile === packageFileName,
    );
    if (
      packageFile &&
      is.nonEmptyArray(updatedConfig.lockFiles) &&
      is.nonEmptyArray(packageFile.lockFiles)
    ) {
      updatedConfig.lockFiles = packageFile.lockFiles;
    }
  }
  return updatedConfig;
}

async function managerUpdateArtifacts(
  manager: string,
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const updateArtifacts = get(manager, 'updateArtifacts');
  if (updateArtifacts) {
    return await updateArtifacts(updateArtifact);
  }
  return null;
}

function processUpdateArtifactResults(
  results: UpdateArtifactsResult[] | null,
  updatedArtifacts: FileChange[],
  artifactErrors: ArtifactError[],
): void {
  if (is.nonEmptyArray(results)) {
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
