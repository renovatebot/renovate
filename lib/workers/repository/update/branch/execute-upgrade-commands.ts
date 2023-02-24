import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import type { PostUpgradeTasks } from '../../../../config/types';
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

export interface UpgradeCommandsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

export async function upgradeTaskExecutor(
  upgradeTask: PostUpgradeTasks | null | undefined,
  config: BranchConfig,
  updatedArtifacts: FileChange[],
  allowedUpgradeCommands: string[] | undefined,
  allowUpgradeCommandTemplating: boolean | undefined,
  upgrade: BranchUpgradeConfig,
  taskType: string
): Promise<UpgradeCommandsExecutionResult> {
  let currentUpdatedArtifacts = updatedArtifacts;
  let artifactErrors: ArtifactError[] = [];

  addMeta({ dep: upgrade.depName });
  logger.trace(
    {
      tasks: upgradeTask,
      allowedCommands: allowedUpgradeCommands,
    },
    `Checking for ${taskType.toLowerCase()} tasks`
  );

  const commands = upgradeTask?.commands ?? [];
  const fileFilters = upgradeTask?.fileFilters ?? [];
  if (is.nonEmptyArray(commands)) {
    // Persist updated files in file system so any executed commands can see them
    const filesToPersist = (config.updatedPackageFiles ?? []).concat(
      currentUpdatedArtifacts
    );
    await persistUpdatedFiles(filesToPersist);

    for (const cmd of commands) {
      const commandError = await upgradeCommandExecutor(
        allowedUpgradeCommands ?? [],
        cmd,
        allowUpgradeCommandTemplating,
        config,
        upgrade,
        taskType
      );
      artifactErrors = [...artifactErrors, ...commandError];
    }

    currentUpdatedArtifacts = await updateUpdatedArtifacts(
      fileFilters,
      currentUpdatedArtifacts,
      taskType
    );
  }
  return { updatedArtifacts: currentUpdatedArtifacts, artifactErrors };
}

export async function persistUpdatedFiles(
  filesToPersist: FileChange[]
): Promise<void> {
  for (const file of filesToPersist) {
    const canWriteFile = await localPathIsFile(file.path);
    if (file.type === 'addition' && canWriteFile) {
      let contents: Buffer | null;
      if (typeof file.contents === 'string') {
        contents = Buffer.from(file.contents);
      } else {
        contents = file.contents;
      }
      // TODO #7154
      await writeLocalFile(file.path, contents!);
    }
  }
}

export async function upgradeCommandExecutor(
  allowedUpgradeCommands: string[],
  cmd: string,
  allowUpgradeCommandTemplating: undefined | boolean,
  config: BranchConfig,
  upgrade: BranchUpgradeConfig,
  taskType: string
): Promise<ArtifactError[]> {
  const artifactErrors = [];
  if (allowedUpgradeCommands.some((pattern) => regEx(pattern).test(cmd))) {
    try {
      const compiledCmd = allowUpgradeCommandTemplating
        ? compile(cmd, mergeChildConfig(config, upgrade))
        : cmd;

      logger.trace(
        { cmd: compiledCmd },
        `Executing ${taskType.toLowerCase()} task'
      );
      const execResult = await exec(compiledCmd, {
        cwd: GlobalConfig.get('localDir'),
      });

      logger.debug(
        { cmd: compiledCmd, ...execResult },
        'Executed ' + taskType.toLowerCase() + ' task'
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
      taskType + ' task did not match any on allowedPostUpgradeCommands list'
    );
    artifactErrors.push({
      lockFile: upgrade.packageFile,
      stderr: sanitize(
        `${taskType} command '${cmd}' has not been added to the allowed list in allowedPostUpgradeCommands`
      ),
    });
  }
  return artifactErrors;
}

export async function updateUpdatedArtifacts(
  fileFilters: string[],
  updatedArtifacts: FileChange[],
  taskType: string
): Promise<FileChange[]> {
  const status = await getRepoStatus();
  let updatedUpdatedArtifacts = updatedArtifacts;

  for (const relativePath of status.modified.concat(status.not_added)) {
    for (const pattern of fileFilters) {
      if (minimatch(relativePath, pattern)) {
        logger.debug({ file: relativePath, pattern }, taskType + ' file saved');
        const existingContent = await readLocalFile(relativePath);
        const existingUpdatedArtifacts = updatedUpdatedArtifacts.find(
          (ua) => ua.path === relativePath
        );
        if (existingUpdatedArtifacts?.type === 'addition') {
          existingUpdatedArtifacts.contents = existingContent;
        } else {
          updatedUpdatedArtifacts.push({
            type: 'addition',
            path: relativePath,
            contents: existingContent,
          });
        }
        // If the file is deleted by a previous update command, remove the deletion from updatedArtifacts
        updatedUpdatedArtifacts = updatedUpdatedArtifacts.filter(
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
          taskType + ' file removed'
        );
        updatedUpdatedArtifacts.push({
          type: 'deletion',
          path: relativePath,
        });
        // If the file is created or modified by a previous update command, remove the modification from updatedArtifacts
        updatedUpdatedArtifacts = updatedUpdatedArtifacts.filter(
          (ua) => !(ua.type === 'addition' && ua.path === relativePath)
        );
      }
    }
  }

  return updatedUpdatedArtifacts;
}
