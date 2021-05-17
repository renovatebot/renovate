import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { getAdminConfig } from '../../config/admin';
import { addMeta, logger } from '../../logger';
import type { ArtifactError } from '../../manager/types';
import { exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { File, getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import { sanitize } from '../../util/sanitize';
import { compile } from '../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../types';

export type PostUpgradeCommandsExecutionResult = {
  updatedArtifacts: File[];
  artifactErrors: ArtifactError[];
};

export async function postUpgradeCommandsExecutor(
  filteredUpgradeCommands: BranchUpgradeConfig[],
  config: BranchConfig
): Promise<PostUpgradeCommandsExecutionResult> {
  let updatedArtifacts = [...(config.updatedArtifacts || [])];
  const artifactErrors = [...(config.artifactErrors || [])];
  const {
    allowedPostUpgradeCommands,
    allowPostUpgradeCommandTemplating,
  } = getAdminConfig();

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.postUpgradeTasks,
        allowedCommands: allowedPostUpgradeCommands,
      },
      `Checking for post-upgrade tasks`
    );
    const commands = upgrade.postUpgradeTasks?.commands || [];
    const fileFilters = upgrade.postUpgradeTasks?.fileFilters || [];

    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      for (const file of config.updatedPackageFiles.concat(updatedArtifacts)) {
        if (file.name !== '|delete|') {
          let contents;
          if (typeof file.contents === 'string') {
            contents = Buffer.from(file.contents);
          } else {
            contents = file.contents;
          }
          await writeLocalFile(file.name, contents);
        }
      }

      for (const cmd of commands) {
        if (
          allowedPostUpgradeCommands.some((pattern) => regEx(pattern).test(cmd))
        ) {
          try {
            const compiledCmd = allowPostUpgradeCommandTemplating
              ? compile(cmd, upgrade)
              : cmd;

            logger.debug({ cmd: compiledCmd }, 'Executing post-upgrade task');
            const execResult = await exec(compiledCmd, {
              cwd: config.localDir,
            });

            logger.debug(
              { cmd: compiledCmd, ...execResult },
              'Executed post-upgrade task'
            );
          } catch (error) {
            artifactErrors.push({
              lockFile: upgrade.packageFile,
              stderr: sanitize(error.message),
            });
          }
        } else {
          logger.warn(
            {
              cmd,
              allowedPostUpgradeCommands,
            },
            'Post-upgrade task did not match any on allowed list'
          );
          artifactErrors.push({
            lockFile: upgrade.packageFile,
            stderr: sanitize(
              `Post-upgrade command '${cmd}' does not match allowed pattern${
                allowedPostUpgradeCommands.length === 1 ? '' : 's'
              } ${allowedPostUpgradeCommands.map((x) => `'${x}'`).join(', ')}`
            ),
          });
        }
      }

      const status = await getRepoStatus();

      for (const relativePath of status.modified.concat(status.not_added)) {
        for (const pattern of fileFilters) {
          if (minimatch(relativePath, pattern)) {
            logger.debug(
              { file: relativePath, pattern },
              'Post-upgrade file saved'
            );
            const existingContent = await readLocalFile(relativePath);
            const existingUpdatedArtifacts = updatedArtifacts.find(
              (ua) => ua.name === relativePath
            );
            if (existingUpdatedArtifacts) {
              existingUpdatedArtifacts.contents = existingContent;
            } else {
              updatedArtifacts.push({
                name: relativePath,
                contents: existingContent,
              });
            }
            // If the file is deleted by a previous post-update command, remove the deletion from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => ua.name !== '|delete|' || ua.contents !== relativePath
            );
          }
        }
      }

      for (const relativePath of status.deleted || []) {
        for (const pattern of fileFilters) {
          if (minimatch(relativePath, pattern)) {
            logger.debug(
              { file: relativePath, pattern },
              'Post-upgrade file removed'
            );
            updatedArtifacts.push({
              name: '|delete|',
              contents: relativePath,
            });
            // If the file is created or modified by a previous post-update command, remove the modification from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => ua.name !== relativePath
            );
          }
        }
      }
    }
  }
  return { updatedArtifacts, artifactErrors };
}

export default async function executePostUpgradeCommands(
  config: BranchConfig
): Promise<PostUpgradeCommandsExecutionResult | null> {
  const { allowedPostUpgradeCommands } = getAdminConfig();

  const hasChangedFiles =
    config.updatedPackageFiles?.length > 0 ||
    config.updatedArtifacts?.length > 0;

  if (
    /* Only run post-upgrade tasks if there are changes to package files... */
    !hasChangedFiles ||
    is.emptyArray(allowedPostUpgradeCommands)
  ) {
    return null;
  }

  const branchUpgradeCommands: BranchUpgradeConfig[] = [
    {
      depName: config.upgrades.map(({ depName }) => depName).join(' '),
      branchName: config.branchName,
      postUpgradeTasks:
        config.postUpgradeTasks.executionMode === 'branch'
          ? config.postUpgradeTasks
          : undefined,
      fileFilters: config.fileFilters,
    },
  ];

  const updateUpgradeCommands: BranchUpgradeConfig[] = config.upgrades.filter(
    ({ postUpgradeTasks }) =>
      !postUpgradeTasks ||
      !postUpgradeTasks.executionMode ||
      postUpgradeTasks.executionMode === 'update'
  );

  const {
    updatedArtifacts,
    artifactErrors,
  } = await postUpgradeCommandsExecutor(updateUpgradeCommands, config);
  return postUpgradeCommandsExecutor(branchUpgradeCommands, {
    ...config,
    updatedArtifacts,
    artifactErrors,
  });
}
