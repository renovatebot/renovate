import crypto from 'crypto';
// TODO #22198
import is from '@sindresorhus/is';
import upath from 'upath';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import { addMeta, logger } from '../../../../logger';
import type { ArtifactError } from '../../../../modules/manager/types';
import { coerceArray } from '../../../../util/array';
import { exec } from '../../../../util/exec';
import type { ExecOptions } from '../../../../util/exec/types';
import {
  localPathIsFile,
  outputCacheFile,
  privateCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { getRepoStatus } from '../../../../util/git';
import { getGitEnvironmentVariables } from '../../../../util/git/auth';
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
  const allowedCommands = GlobalConfig.get('allowedCommands');

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.postUpgradeTasks,
        allowedCommands,
      },
      `Checking for post-upgrade tasks`,
    );
    const commands = upgrade.postUpgradeTasks?.commands;
    const dataFileTemplate = upgrade.postUpgradeTasks?.dataFileTemplate;
    const fileFilters = upgrade.postUpgradeTasks?.fileFilters ?? ['**/*'];
    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      const previouslyModifiedFiles =
        config.updatedPackageFiles!.concat(updatedArtifacts);
      for (const file of previouslyModifiedFiles) {
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

      let dataFilePath: string | null = null;
      if (dataFileTemplate) {
        const dataFileContent = sanitize(
          compile(dataFileTemplate, mergeChildConfig(config, upgrade)),
        );
        logger.debug(
          { dataFileTemplate },
          'Processed post-upgrade commands data file template.',
        );

        const dataFileName = `post-upgrade-data-file-${crypto.randomBytes(8).toString('hex')}.tmp`;
        dataFilePath = upath.join(privateCacheDir(), dataFileName);

        try {
          await outputCacheFile(dataFilePath, dataFileContent);

          logger.debug(
            { dataFilePath, dataFileContent },
            'Created post-upgrade commands data file.',
          );
        } catch (error) {
          artifactErrors.push({
            stderr: sanitize(
              `Failed to create post-upgrade commands data file at ${dataFilePath}, reason: ${error.message}`,
            ),
          });

          dataFilePath = null;
        }
      }

      for (const cmd of commands) {
        const compiledCmd = compile(cmd, mergeChildConfig(config, upgrade));
        if (compiledCmd !== cmd) {
          logger.debug(
            { rawCmd: cmd, compiledCmd },
            'Post-upgrade command has been compiled',
          );
        }
        if (
          allowedCommands!.some((pattern) => regEx(pattern).test(compiledCmd))
        ) {
          try {
            logger.trace({ cmd: compiledCmd }, 'Executing post-upgrade task');

            const execOpts: ExecOptions = {
              cwd: GlobalConfig.get('localDir'),
              extraEnv: getGitEnvironmentVariables(),
            };
            if (dataFilePath) {
              execOpts.env = {
                RENOVATE_POST_UPGRADE_COMMAND_DATA_FILE: dataFilePath,
              };
            }
            const execResult = await exec(compiledCmd, execOpts);

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
              cmd: compiledCmd,
              allowedCommands,
            },
            'Post-upgrade task did not match any on allowedCommands list',
          );
          artifactErrors.push({
            lockFile: upgrade.packageFile,
            stderr: sanitize(
              `Post-upgrade command '${compiledCmd}' has not been added to the allowed list in allowedCommands`,
            ),
          });
        }
      }

      const status = await getRepoStatus();

      logger.trace({ status }, 'git status after post-upgrade tasks');

      logger.debug(
        {
          addedCount: status.not_added?.length,
          modifiedCount: status.modified?.length,
          deletedCount: status.deleted?.length,
          renamedCount: status.renamed?.length,
        },
        'git status counts after post-upgrade tasks',
      );

      const addedOrModifiedFiles = [
        ...coerceArray(status.not_added),
        ...coerceArray(status.modified),
        ...coerceArray(status.renamed?.map((x) => x.to)),
      ];
      const changedFiles = [
        ...addedOrModifiedFiles,
        ...coerceArray(status.deleted),
        ...coerceArray(status.renamed?.map((x) => x.from)),
      ];

      // Check for files which were previously deleted but have been re-added without modification
      const previouslyDeletedFiles = updatedArtifacts.filter(
        (ua) => ua.type === 'deletion',
      );
      for (const previouslyDeletedFile of previouslyDeletedFiles) {
        if (!changedFiles.includes(previouslyDeletedFile.path)) {
          logger.debug(
            { file: previouslyDeletedFile.path },
            'Previously deleted file has been restored without modification',
          );
          updatedArtifacts = updatedArtifacts.filter(
            (ua) =>
              !(
                ua.type === 'deletion' && ua.path === previouslyDeletedFile.path
              ),
          );
        }
      }

      logger.trace({ addedOrModifiedFiles }, 'Added or modified files');
      logger.debug(
        `Checking ${addedOrModifiedFiles.length} added or modified files for post-upgrade changes`,
      );

      for (const relativePath of addedOrModifiedFiles) {
        let fileMatched = false;
        for (const pattern of fileFilters) {
          if (minimatch(pattern, { dot: true }).match(relativePath)) {
            fileMatched = true;
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
        if (!fileMatched) {
          logger.debug(
            { file: relativePath },
            'Post-upgrade file did not match any file filters',
          );
        }
      }

      for (const relativePath of coerceArray(status.deleted)) {
        for (const pattern of fileFilters) {
          if (minimatch(pattern, { dot: true }).match(relativePath)) {
            if (
              !updatedArtifacts.some(
                (ua) => ua.path === relativePath && ua.type === 'deletion',
              )
            ) {
              logger.debug(
                { file: relativePath, pattern },
                'Post-upgrade file removed',
              );
              updatedArtifacts.push({
                type: 'deletion',
                path: relativePath,
              });
            }
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

  if (!hasChangedFiles) {
    /* Only run post-upgrade tasks if there are changes to package files... */
    logger.debug('No changes to package files, skipping post-upgrade tasks');
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
