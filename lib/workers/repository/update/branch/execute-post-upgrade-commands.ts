// TODO #22198
import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import { addMeta, logger } from '../../../../logger';
import type { ArtifactError } from '../../../../modules/manager/types';
import { coerceArray } from '../../../../util/array';
import { exec } from '../../../../util/exec';
import {
  localPathIsFile,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { getRepoStatus } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';
import { minimatch } from '../../../../util/minimatch';
import { regEx } from '../../../../util/regex';
import { sanitize } from '../../../../util/sanitize';
import { compile } from '../../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';

export interface PostUpgradeCommandsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

export async function postUpgradeCommandsExecutor(
  filteredUpgradeCommands: BranchUpgradeConfig[],
  config: BranchConfig,
): Promise<PostUpgradeCommandsExecutionResult> {
  let updatedArtifacts = [...(config.updatedArtifacts ?? [])];
  const artifactErrors = [...(config.artifactErrors ?? [])];
  const allowedPostUpgradeCommands = GlobalConfig.get(
    'allowedPostUpgradeCommands',
  );
  const allowPostUpgradeCommandTemplating = GlobalConfig.get(
    'allowPostUpgradeCommandTemplating',
  );

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.postUpgradeTasks,
        allowedCommands: allowedPostUpgradeCommands,
      },
      `Checking for post-upgrade tasks`,
    );
    const commands = upgrade.postUpgradeTasks?.commands;
    const fileFilters = upgrade.postUpgradeTasks?.fileFilters ?? ['**/*'];
    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      for (const file of config.updatedPackageFiles!.concat(updatedArtifacts)) {
        const canWriteFile = await localPathIsFile(file.path);
        if (file.type === 'addition' && !file.isSymlink && canWriteFile) {
          let contents: Buffer | null;
          if (typeof file.contents === 'string') {
            contents = Buffer.from(file.contents);
          } else {
            contents = file.contents;
          }
          // TODO #22198
          await writeLocalFile(file.path, contents!);
        }
      }

      for (const cmd of commands) {
        if (
          allowedPostUpgradeCommands!.some((pattern) =>
            regEx(pattern).test(cmd),
          )
        ) {
          try {
            const compiledCmd = allowPostUpgradeCommandTemplating
              ? compile(cmd, mergeChildConfig(config, upgrade))
              : cmd;

            logger.trace({ cmd: compiledCmd }, 'Executing post-upgrade task');
            const execResult = await exec(compiledCmd, {
              cwd: GlobalConfig.get('localDir'),
            });

            logger.debug(
              { cmd: compiledCmd, ...execResult },
              'Executed post-upgrade task',
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
            'Post-upgrade task did not match any on allowedPostUpgradeCommands list',
          );
          artifactErrors.push({
            lockFile: upgrade.packageFile,
            stderr: sanitize(
              `Post-upgrade command '${cmd}' has not been added to the allowed list in allowedPostUpgradeCommands`,
            ),
          });
        }
      }

      const status = await getRepoStatus();

      for (const relativePath of status.modified.concat(status.not_added)) {
        for (const pattern of fileFilters) {
          if (minimatch(pattern, { dot: true }).match(relativePath)) {
            logger.debug(
              { file: relativePath, pattern },
              'Post-upgrade file saved',
            );
            const existingContent = await readLocalFile(relativePath);
            const existingUpdatedArtifacts = updatedArtifacts.find(
              (ua) => ua.path === relativePath,
            );
            if (existingUpdatedArtifacts?.type === 'addition') {
              existingUpdatedArtifacts.contents = existingContent;
            } else {
              updatedArtifacts.push({
                type: 'addition',
                path: relativePath,
                contents: existingContent,
              });
            }
            // If the file is deleted by a previous post-update command, remove the deletion from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => !(ua.type === 'deletion' && ua.path === relativePath),
            );
          }
        }
      }

      for (const relativePath of coerceArray(status.deleted)) {
        for (const pattern of fileFilters) {
          if (minimatch(pattern, { dot: true }).match(relativePath)) {
            logger.debug(
              { file: relativePath, pattern },
              'Post-upgrade file removed',
            );
            updatedArtifacts.push({
              type: 'deletion',
              path: relativePath,
            });
            // If the file is created or modified by a previous post-update command, remove the modification from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => !(ua.type === 'addition' && ua.path === relativePath),
            );
          }
        }
      }
    }
  }
  return { updatedArtifacts, artifactErrors };
}

export default async function executePostUpgradeCommands(
  config: BranchConfig,
): Promise<PostUpgradeCommandsExecutionResult | null> {
  const hasChangedFiles =
    (is.array(config.updatedPackageFiles) &&
      config.updatedPackageFiles.length > 0) ||
    (is.array(config.updatedArtifacts) && config.updatedArtifacts.length > 0);

  if (
    /* Only run post-upgrade tasks if there are changes to package files... */
    !hasChangedFiles ||
    is.emptyArray(GlobalConfig.get('allowedPostUpgradeCommands'))
  ) {
    return null;
  }

  const branchUpgradeCommands: BranchUpgradeConfig[] = [
    {
      manager: config.manager,
      depName: config.upgrades.map(({ depName }) => depName).join(' '),
      branchName: config.branchName,
      postUpgradeTasks:
        config.postUpgradeTasks!.executionMode === 'branch'
          ? config.postUpgradeTasks
          : undefined,
      fileFilters: config.fileFilters,
    },
  ];

  const updateUpgradeCommands: BranchUpgradeConfig[] = config.upgrades.filter(
    ({ postUpgradeTasks }) =>
      !postUpgradeTasks?.executionMode ||
      postUpgradeTasks.executionMode === 'update',
  );

  const { updatedArtifacts, artifactErrors } =
    await postUpgradeCommandsExecutor(updateUpgradeCommands, config);
  return postUpgradeCommandsExecutor(branchUpgradeCommands, {
    ...config,
    updatedArtifacts,
    artifactErrors,
  });
}
