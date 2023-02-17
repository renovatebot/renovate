import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import { addMeta, logger } from '../../../../logger';
import type { ArtifactError } from '../../../../modules/manager/types';
import { exec } from '../../../../util/exec';
import {
  localPathIsFile,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { getRepoStatus } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';
import { regEx } from '../../../../util/regex';
import { sanitize } from '../../../../util/sanitize';
import { compile } from '../../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';

export interface PreUpgradeCommandsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

export async function preUpgradeCommandsExecutor(
  filteredUpgradeCommands: BranchUpgradeConfig[],
  config: BranchConfig
): Promise<PreUpgradeCommandsExecutionResult> {
  let updatedArtifacts = [...(config.updatedArtifacts ?? [])];
  const artifactErrors = [...(config.artifactErrors ?? [])];
  const { allowedUpgradeCommands, allowUpgradeCommandTemplating } =
    GlobalConfig.get();

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.preUpgradeTasks,
        allowedCommands: allowedUpgradeCommands,
      },
      `Checking for pre-upgrade tasks`
    );
    const commands = upgrade.preUpgradeTasks?.commands ?? [];
    const fileFilters = upgrade.preUpgradeTasks?.fileFilters ?? [];
    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      for (const file of (config.updatedPackageFiles ?? []).concat(
        updatedArtifacts
      )) {
        const canWriteFile = await localPathIsFile(file.path);
        if (file.type === 'addition' && canWriteFile) {
          let contents: Buffer | null;
          if (typeof file.contents === 'string') {
            contents = Buffer.from(file.contents);
          } else {
            contents = file.contents;
          }
          await writeLocalFile(file.path, contents!);
        }
      }

      for (const cmd of commands) {
        if (
          allowedUpgradeCommands!.some((pattern) => regEx(pattern).test(cmd))
        ) {
          try {
            const compiledCmd = allowUpgradeCommandTemplating
              ? compile(cmd, mergeChildConfig(config, upgrade))
              : cmd;

            logger.trace({ cmd: compiledCmd }, 'Executing pre-upgrade task');
            const execResult = await exec(compiledCmd, {
              cwd: GlobalConfig.get('localDir'),
            });

            logger.debug(
              { cmd: compiledCmd, ...execResult },
              'Executed pre-upgrade task'
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
              allowedUpgradeCommands,
            },
            'Pre-upgrade task did not match any on allowedUpgradeCommands list'
          );
          artifactErrors.push({
            lockFile: upgrade.packageFile,
            stderr: sanitize(
              `Pre-upgrade command '${cmd}' has not been added to the allowed list in allowedUpgradeCommands`
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
              'Pre-upgrade file saved'
            );
            const existingContent = await readLocalFile(relativePath);
            const existingUpdatedArtifacts = updatedArtifacts.find(
              (ua) => ua.path === relativePath
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
            // If the file is deleted by a previous pre-update command, remove the deletion from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => !(ua.type === 'deletion' && ua.path === relativePath)
            );
          }
        }
      }

      for (const relativePath of status.deleted || []) {
        for (const pattern of fileFilters) {
          if (minimatch(relativePath, pattern)) {
            logger.debug(
              { file: relativePath, pattern },
              'Pre-upgrade file removed'
            );
            updatedArtifacts.push({
              type: 'deletion',
              path: relativePath,
            });
            // If the file is created or modified by a previous pre-update command, remove the modification from updatedArtifacts
            updatedArtifacts = updatedArtifacts.filter(
              (ua) => !(ua.type === 'addition' && ua.path === relativePath)
            );
          }
        }
      }
    }
  }
  return { updatedArtifacts, artifactErrors };
}

export default async function executePreUpgradeCommands(
  config: BranchConfig
): Promise<PreUpgradeCommandsExecutionResult | null> {
  const { allowedUpgradeCommands } = GlobalConfig.get();

  if (is.emptyArray(allowedUpgradeCommands)) {
    return null;
  }

  const branchUpgradeCommands: BranchUpgradeConfig[] = [
    {
      manager: config.manager,
      depName: config.upgrades.map(({ depName }) => depName).join(' '),
      branchName: config.branchName,
      preUpgradeTasks:
        config.preUpgradeTasks!.executionMode === 'branch'
          ? config.preUpgradeTasks
          : undefined,
      fileFilters: config.fileFilters,
    },
  ];

  const updateUpgradeCommands: BranchUpgradeConfig[] = config.upgrades.filter(
    ({ preUpgradeTasks }) =>
      !preUpgradeTasks?.executionMode ||
      preUpgradeTasks.executionMode === 'update'
  );

  const { updatedArtifacts, artifactErrors } = await preUpgradeCommandsExecutor(
    updateUpgradeCommands,
    config
  );
  return preUpgradeCommandsExecutor(branchUpgradeCommands, {
    ...config,
    updatedArtifacts,
    artifactErrors,
  });
}
