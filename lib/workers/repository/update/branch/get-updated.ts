import { isNonEmptyArray } from '@sindresorhus/is';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { extractPackageFile, get } from '../../../../modules/manager/index.ts';
import type {
  ArtifactError,
  ArtifactNotice,
  PackageFile,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../../../../modules/manager/types.ts';
import { getFile } from '../../../../util/git/index.ts';
import type { FileAddition, FileChange } from '../../../../util/git/types.ts';
import { coerceString } from '../../../../util/string.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types.ts';
import { doAutoReplace } from './auto-replace.ts';
import { executeCustomUpdateCommands } from './execute-update-commands.ts';

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
  const packageFileUpdatedDeps: Record<string, BranchUpgradeConfig[]> = {};
  const lockFileMaintenanceFiles: string[] = [];
  const updateCommandArtifacts: FileChange[] = [];
  const updateCommandErrors: ArtifactError[] = [];
  let firstUpdate = true;
  for (const upgrade of config.upgrades) {
    const manager = upgrade.manager;
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
      if (upgrade.customUpdateCommands?.commands?.length) {
        if (reuseExistingBranch) {
          logger.debug(
            { packageFile, depName },
            'Need to rebase branch as customUpdateCommands cannot verify existing branch output',
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(
          { packageFile, depName },
          'Using customUpdateCommands instead of lockFileMaintenance',
        );
        const result = await executeCustomUpdateCommands(upgrade, config);
        for (const file of result.updatedPackageFiles) {
          if (file.type === 'addition') {
            updatedFileContents[file.path] = file.contents!.toString();
            delete nonUpdatedFileContents[file.path];
          }
        }
        updateCommandArtifacts.push(...result.updatedArtifacts);
        updateCommandErrors.push(...result.artifactErrors);
        continue;
      }
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
      if (upgrade.customUpdateCommands?.commands?.length) {
        if (reuseExistingBranch) {
          logger.debug(
            { packageFile, depName },
            'Need to rebase branch as customUpdateCommands cannot verify existing branch output',
          );
          return getUpdatedPackageFiles({
            ...config,
            reuseExistingBranch: false,
          });
        }
        logger.debug(
          { packageFile, depName },
          'Using customUpdateCommands instead of auto-replace',
        );
        const result = await executeCustomUpdateCommands(upgrade, config);
        for (const file of result.updatedPackageFiles) {
          if (file.type === 'addition') {
            updatedFileContents[file.path] = file.contents!.toString();
            delete nonUpdatedFileContents[file.path];
          }
        }
        updateCommandArtifacts.push(...result.updatedArtifacts);
        updateCommandErrors.push(...result.artifactErrors);
        continue;
      }
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
        packageFile,
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
  const updatedArtifacts: FileChange[] = [...updateCommandArtifacts];
  const artifactErrors: ArtifactError[] = [...updateCommandErrors];
  const artifactNotices: ArtifactNotice[] = [];
  if (isNonEmptyArray(updatedPackageFiles)) {
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
        if (isNonEmptyArray(results)) {
          await checkForPendingVersions(
            manager,
            packageFile.path,
            packageFile.contents!.toString(),
            updatedDeps,
            artifactErrors,
            config,
          );
        }
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
  if (isNonEmptyArray(nonUpdatedPackageFiles)) {
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
        if (isNonEmptyArray(results)) {
          updatedPackageFiles.push(packageFile);
          await checkForPendingVersions(
            manager,
            packageFile.path,
            packageFile.contents!.toString(),
            updatedDeps,
            artifactErrors,
            config,
          );
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
    if (isNonEmptyArray(lockFileMaintenanceFiles)) {
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
  const updatedConfig = { ...config };
  delete updatedConfig.lockFiles;
  if (isNonEmptyArray(updatedConfig.packageFiles?.[manager])) {
    const managerPackageFiles: PackageFile[] =
      updatedConfig.packageFiles?.[manager];
    const packageFile = managerPackageFiles.find(
      (p) => p.packageFile === packageFileName,
    );
    if (packageFile && isNonEmptyArray(packageFile.lockFiles)) {
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
  if (!updateArtifacts) {
    return null;
  }

  if (updateArtifact.config.skipArtifactsUpdate) {
    logger.debug(
      { manager, packageFileName: updateArtifact.packageFileName },
      'Skipping artifact update',
    );
    return null;
  }

  return await updateArtifacts(updateArtifact);
}

function processUpdateArtifactResults(
  results: UpdateArtifactsResult[] | null,
  updatedArtifacts: FileChange[],
  artifactErrors: ArtifactError[],
  artifactNotices: ArtifactNotice[],
): void {
  if (isNonEmptyArray(results)) {
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

/**
 * When using Minimum Release Age, and a package manager that doesn't support being told an explicit version to update to (#41624) it is possible that an artifact update leads to a different version of a dependency being used compared to what Renovate is expecting.
 *
 * We should report these cases more explicitly with an Artifact Error, to allow the reviewers to decide what to do with the changes.
 */
async function checkForPendingVersions(
  manager: string,
  packageFileName: string,
  packageFileContent: string,
  updatedDeps: BranchUpgradeConfig[],
  artifactErrors: ArtifactError[],
  config: BranchConfig,
): Promise<void> {
  const depNameToUpgradeInfo = new Map<
    string,
    {
      pendingVersions: Set<string>;
      newVersion: string | undefined;
    }
  >();
  for (const dep of updatedDeps) {
    if (dep.depName && isNonEmptyArray(dep.pendingVersions)) {
      depNameToUpgradeInfo.set(dep.depName, {
        pendingVersions: new Set(dep.pendingVersions),
        newVersion: dep.newVersion,
      });
    }
  }
  if (!depNameToUpgradeInfo.size) {
    return;
  }

  const extracted = await extractPackageFile(
    manager,
    packageFileContent,
    packageFileName,
    config,
  );
  if (!extracted) {
    logger.warn(
      { packageFile: packageFileName, manager },
      'Could not re-extract the packageFile after updating it',
    );
    return;
  }

  for (const dep of extracted.deps) {
    const depName = dep.depName ?? dep.packageName;
    // shouldn't ever happen
    if (!depName) {
      logger.error(
        {
          packageFile: packageFileName,
          manager,
          branchName: config.branchName,
          depName: dep.depName,
        },
        `No depName found after updating '${packageFileName}'`,
      );
      throw new Error(WORKER_FILE_UPDATE_FAILED);
    }

    const upgradeInfo = depNameToUpgradeInfo.get(depName);
    if (!upgradeInfo) {
      continue;
    }
    const resolvedVersion =
      dep.lockedVersion ??
      dep.newVersion ??
      dep.currentVersion ??
      dep.currentValue;
    if (!resolvedVersion) {
      logger.error(
        {
          packageFile: packageFileName,
          manager,
          branchName: config.branchName,
          depName,
          newVersion: resolvedVersion,
        },
        `No new version found for '${depName}' after updating '${packageFileName}'`,
      );
      throw new Error(WORKER_FILE_UPDATE_FAILED);
    }

    if (resolvedVersion && upgradeInfo.pendingVersions.has(resolvedVersion)) {
      const expectedVersion = upgradeInfo.newVersion;
      /* v8 ignore next if -- should not happen */
      if (!expectedVersion) {
        logger.error(
          {
            packageFile: packageFileName,
            manager,
            branchName: config.branchName,
            depName,
            newVersion: resolvedVersion,
            expectedVersion,
          },
          `No expectedVersion found for '${depName}' after updating '${packageFileName}'`,
        );
        continue;
      }

      if (config.minimumReleaseAgeBehaviour === 'timestamp-optional') {
        logger.once.warn(
          {
            packageFileName,
            depName,
            expectedVersion,
            resolvedVersion,
          },
          "Artifact error would be reported due to a pending version in use which hasn't passed Minimum Release Age, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding. See debug logs for more information",
        );
        continue;
      }

      logger.debug(
        {
          packageFileName,
          depName,
          expectedVersion,
          resolvedVersion,
        },
        'Artifact update introduced a pending version',
      );
      let stderr = `Artifact update for ${depName} resolved to version ${resolvedVersion}, which is a pending version that has not yet passed the Minimum Release Age threshold.`;
      stderr += `\nRenovate was attempting to update to ${expectedVersion}`;
      stderr += `\nThis is (likely) not a bug in Renovate, but due to the way your project pins dependencies, _and_ how Renovate calls your package manager to update them.\nUntil Renovate supports specifying an exact update to your package manager (https://github.com/renovatebot/renovate/issues/41624), it is recommended to directly pin your dependencies (with \`rangeStrategy=pin\` for apps, or \`rangeStrategy=widen\` for libraries)\nSee also: https://docs.renovatebot.com/dependency-pinning/`;

      artifactErrors.push({
        fileName: packageFileName,
        stderr,
      });
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
