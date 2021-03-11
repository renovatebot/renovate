import minimatch from 'minimatch';
import { getAdminConfig } from '../../config/admin';
import { addMeta, logger } from '../../logger';
import { exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { regEx } from '../../util/regex';
import { BranchUpgradeConfig } from '../types';
import * as template from '../../util/template';
import is from '@sindresorhus/is';

export default async function postUpgradeCommandExecutor(
  executionMode = 'update',
  config
) {
  const adminConfig = getAdminConfig();
  const allowedPostUpgradeCommands = adminConfig.allowedPostUpgradeCommands;
  const allowPostUpgradeCommandTemplating =
    executionMode === 'update' && adminConfig.allowPostUpgradeCommandTemplating;

  const filteredUpgradeCommands: BranchUpgradeConfig[] = config.upgrades.filter(
    ({ postUpgradeTasks }) =>
      !postUpgradeTasks ||
      !postUpgradeTasks.executionMode ||
      postUpgradeTasks.executionMode == executionMode
  );

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.postUpgradeTasks,
        allowedCommands: allowedPostUpgradeCommands,
      },
      `Checking for ${executionMode} level post-upgrade tasks`
    );
    const commands = upgrade.postUpgradeTasks.commands || [];
    const fileFilters = upgrade.postUpgradeTasks.fileFilters || [];

    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      for (const file of config.updatedPackageFiles.concat(
        config.updatedArtifacts
      )) {
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
          const compiledCmd = allowPostUpgradeCommandTemplating
            ? template.compile(cmd, upgrade)
            : cmd;

          logger.debug({ cmd: compiledCmd }, 'Executing post-upgrade task');

          const execResult = await exec(compiledCmd, {
            cwd: config.localDir,
          });

          logger.debug(
            { cmd: compiledCmd, ...execResult },
            'Executed post-upgrade task'
          );
        } else {
          logger.warn(
            {
              cmd,
              allowedPostUpgradeCommands,
            },
            'Post-upgrade task did not match any on allowed list'
          );
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
            const existingUpdatedArtifacts = config.updatedArtifacts.find(
              (ua) => ua.name === relativePath
            );
            if (existingUpdatedArtifacts) {
              existingUpdatedArtifacts.contents = existingContent;
            } else {
              config.updatedArtifacts.push({
                name: relativePath,
                contents: existingContent,
              });
            }
            // If the file is deleted by a previous post-update command, remove the deletion from updatedArtifacts
            config.updatedArtifacts = config.updatedArtifacts.filter(
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
            config.updatedArtifacts.push({
              name: '|delete|',
              contents: relativePath,
            });
            // If the file is created or modified by a previous post-update command, remove the modification from updatedArtifacts
            config.updatedArtifacts = config.updatedArtifacts.filter(
              (ua) => ua.name !== relativePath
            );
          }
        }
      }
    }
  }
}
