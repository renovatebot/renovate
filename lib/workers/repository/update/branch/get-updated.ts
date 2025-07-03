/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import is from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { get } from '../../../../modules/manager';
import type {
  ArtifactError,
  ArtifactNotice,
  PackageDependency,
  PackageFile,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../../../../modules/manager/types';
import { getFile } from '../../../../util/git';
import type { FileAddition, FileChange } from '../../../../util/git/types';
import { coerceString } from '../../../../util/string';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import { doAutoReplace } from './auto-replace';

export interface PackageFilesResult {
  artifactErrors: ArtifactError[];
  reuseExistingBranch?: boolean;
  updatedPackageFiles: FileChange[];
  updatedArtifacts: FileChange[];
  artifactNotices: ArtifactNotice[];
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

function sortPackageFiles(
  config: BranchConfig,
  manager: string,
  packageFiles: FilePath[],
): void {
  const managerPackageFiles = config.packageFiles?.[manager];
  if (!managerPackageFiles) {
    return;
  }
  packageFiles.sort((lhs, rhs) => {
    const lhsIndex = managerPackageFiles.findIndex(
      (entry) => entry.packageFile === lhs.path,
    );
    const rhsIndex = managerPackageFiles.findIndex(
      (entry) => entry.packageFile === rhs.path,
    );
    return lhsIndex - rhsIndex;
  });
}

function hasAny(set: Set<string>, targets: Iterable<string>): boolean {
  for (const target of targets) {
    if (set.has(target)) {
      return true;
    }
  }
  return false;
}

type FilePath = Pick<FileChange, 'path'>;

function getManagersForPackageFiles<T extends FilePath>(
  packageFiles: T[],
  managerPackageFiles: Record<string, Set<string>>,
): Set<string> {
  const packageFileNames = packageFiles.map((packageFile) => packageFile.path);
  return new Set(
    Object.keys(managerPackageFiles).filter((manager) =>
      hasAny(managerPackageFiles[manager], packageFileNames),
    ),
  );
}

function getPackageFilesForManager<T extends FilePath>(
  packageFiles: T[],
  managerPackageFiles: Set<string>,
): T[] {
  return packageFiles.filter((packageFile) =>
    managerPackageFiles.has(packageFile.path),
  );
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
  const managerPackageFiles: Record<string, Set<string>> = {};
  const packageFileUpdatedDeps: Record<string, PackageDependency[]> = {};
  const lockFileMaintenanceFiles: string[] = [];
  let firstUpdate = true;
  for (const upgrade of config.upgrades) {
    const manager = upgrade.manager!;
    const packageFile = upgrade.packageFile!;
    const depName = upgrade.depName!;
    // TODO: fix types, can be undefined (#22198)
    const newVersion = upgrade.newVersion!;
    const currentVersion = upgrade.currentVersion!;
    const updateLockedDependency = get(manager, 'updateLockedDependency')!;
    managerPackageFiles[manager] ??= new Set<string>();
    managerPackageFiles[manager].add(packageFile);
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
          res = await applyManagerBumpPackageVersion(res, upgrade);
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
      newContent = await applyManagerBumpPackageVersion(newContent, upgrade);
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
  const artifactNotices: ArtifactNotice[] = [];
  if (is.nonEmptyArray(updatedPackageFiles)) {
    logger.debug('updateArtifacts for updatedPackageFiles');
    const updatedPackageFileManagers = getManagersForPackageFiles(
      updatedPackageFiles,
      managerPackageFiles,
    );
    for (const manager of updatedPackageFileManagers) {
      const packageFilesForManager = getPackageFilesForManager(
        updatedPackageFiles,
        managerPackageFiles[manager],
      );
      sortPackageFiles(config, manager, packageFilesForManager);
      for (const packageFile of packageFilesForManager) {
        const updatedDeps = packageFileUpdatedDeps[packageFile.path];
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
        processUpdateArtifactResults(
          results,
          updatedArtifacts,
          artifactErrors,
          artifactNotices,
        );
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
  if (is.nonEmptyArray(nonUpdatedPackageFiles)) {
    logger.debug('updateArtifacts for nonUpdatedPackageFiles');
    const nonUpdatedPackageFileManagers = getManagersForPackageFiles(
      nonUpdatedPackageFiles,
      managerPackageFiles,
    );
    for (const manager of nonUpdatedPackageFileManagers) {
      const packageFilesForManager = getPackageFilesForManager(
        nonUpdatedPackageFiles,
        managerPackageFiles[manager],
      );
      sortPackageFiles(config, manager, packageFilesForManager);
      for (const packageFile of packageFilesForManager) {
        const updatedDeps = packageFileUpdatedDeps[packageFile.path];
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
        processUpdateArtifactResults(
          results,
          updatedArtifacts,
          artifactErrors,
          artifactNotices,
        );
        if (is.nonEmptyArray(results)) {
          updatedPackageFiles.push(packageFile);
        }
      }
    }
  }
  if (!reuseExistingBranch) {
    const lockFileMaintenancePackageFiles: FilePath[] =
      lockFileMaintenanceFiles.map((name) => ({
        path: name,
      }));
    // Only perform lock file maintenance if it's a fresh commit
    if (is.nonEmptyArray(lockFileMaintenanceFiles)) {
      logger.debug('updateArtifacts for lockFileMaintenanceFiles');
      const lockFileMaintenanceManagers = getManagersForPackageFiles(
        lockFileMaintenancePackageFiles,
        managerPackageFiles,
      );
      for (const manager of lockFileMaintenanceManagers) {
        const packageFilesForManager = getPackageFilesForManager(
          lockFileMaintenancePackageFiles,
          managerPackageFiles[manager],
        );
        sortPackageFiles(config, manager, packageFilesForManager);
        for (const packageFile of packageFilesForManager) {
          const contents =
            updatedFileContents[packageFile.path] ||
            (await getFile(packageFile.path, config.baseBranch));
          const results = await managerUpdateArtifacts(manager, {
            packageFileName: packageFile.path,
            updatedDeps: [],
            newPackageFileContent: contents!,
            config: patchConfigForArtifactsUpdate(
              config,
              manager,
              packageFile.path,
            ),
          });
          processUpdateArtifactResults(
            results,
            updatedArtifacts,
            artifactErrors,
            artifactNotices,
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
    artifactNotices,
  };
}

// workaround, see #27319
function patchConfigForArtifactsUpdate(
  config: BranchConfig,
  manager: string,
  packageFileName: string,
): UpdateArtifactsConfig {
  // drop any lockFiles that happen to be defined on the branch config
  const { lockFiles, ...updatedConfig } = config;
  if (is.nonEmptyArray(updatedConfig.packageFiles?.[manager])) {
    const managerPackageFiles: PackageFile[] =
      updatedConfig.packageFiles?.[manager];
    const packageFile = managerPackageFiles.find(
      (p) => p.packageFile === packageFileName,
    );
    if (packageFile && is.nonEmptyArray(packageFile.lockFiles)) {
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
  artifactNotices: ArtifactNotice[],
): void {
  if (is.nonEmptyArray(results)) {
    for (const res of results) {
      const { file, notice, artifactError } = res;
      if (file) {
        updatedArtifacts.push(file);
      }

      if (artifactError) {
        artifactErrors.push(artifactError);
      }

      if (notice) {
        artifactNotices.push(notice);
      }
    }
  }
}

async function applyManagerBumpPackageVersion(
  packageFileContent: string | null,
  upgrade: BranchUpgradeConfig,
): Promise<string | null> {
  const bumpPackageVersion = get(upgrade.manager, 'bumpPackageVersion');
  if (
    !bumpPackageVersion ||
    !packageFileContent ||
    !upgrade.bumpVersion ||
    !upgrade.packageFileVersion
  ) {
    return packageFileContent;
  }

  const result = await bumpPackageVersion(
    packageFileContent,
    upgrade.packageFileVersion,
    upgrade.bumpVersion,
    upgrade.packageFile!,
  );

  return result.bumpedContent;
}
