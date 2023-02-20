import minimatch from 'minimatch';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { ArtifactError } from '../../../../modules/manager/types';
import { exec } from '../../../../util/exec';
import { readLocalFile } from '../../../../util/fs';
import { getRepoStatus } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';
import { regEx } from '../../../../util/regex';
import { sanitize } from '../../../../util/sanitize';
import { compile } from '../../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';

export async function upgradeCommandExecutor(
  allowedUpgradeCommands: string[],
  cmd: string,
  allowUpgradeCommandTemplating: undefined | boolean,
  config: BranchConfig,
  upgrade: BranchUpgradeConfig
): Promise<ArtifactError[]> {
  const artifactErrors = [];
  if (allowedUpgradeCommands.some((pattern) => regEx(pattern).test(cmd))) {
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
      'Pre-upgrade task did not match any on allowedPostUpgradeCommands list'
    );
    artifactErrors.push({
      lockFile: upgrade.packageFile,
      stderr: sanitize(
        `Pre-upgrade command '${cmd}' has not been added to the allowed list in allowedPostUpgradeCommands`
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
