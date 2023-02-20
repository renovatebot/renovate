// TODO #7154
import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import { GlobalConfig } from '../../../../config/global';
import { addMeta, logger } from '../../../../logger';
import type { ArtifactError } from '../../../../modules/manager/types';
import { exec } from '../../../../util/exec';
import { localPathIsFile, writeLocalFile } from '../../../../util/fs';
import type { FileChange } from '../../../../util/git/types';
import { regEx } from '../../../../util/regex';
import { sanitize } from '../../../../util/sanitize';
import { compile } from '../../../../util/template';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types';
import { updateUpdatedArtifacts } from './execute-upgrade-commands';

export interface PostUpgradeCommandsExecutionResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

export async function postUpgradeCommandsExecutor(
  filteredUpgradeCommands: BranchUpgradeConfig[],
  config: BranchConfig
): Promise<PostUpgradeCommandsExecutionResult> {
  let updatedArtifacts = [...(config.updatedArtifacts ?? [])];
  const artifactErrors = [...(config.artifactErrors ?? [])];
  const { allowedPostUpgradeCommands, allowPostUpgradeCommandTemplating } =
    GlobalConfig.get();

  for (const upgrade of filteredUpgradeCommands) {
    addMeta({ dep: upgrade.depName });
    logger.trace(
      {
        tasks: upgrade.postUpgradeTasks,
        allowedCommands: allowedPostUpgradeCommands,
      },
      `Checking for post-upgrade tasks`
    );
    const commands = upgrade.postUpgradeTasks?.commands ?? [];
    const fileFilters = upgrade.postUpgradeTasks?.fileFilters ?? [];
    if (is.nonEmptyArray(commands)) {
      // Persist updated files in file system so any executed commands can see them
      for (const file of config.updatedPackageFiles!.concat(updatedArtifacts)) {
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

      for (const cmd of commands) {
        if (
          allowedPostUpgradeCommands!.some((pattern) =>
            regEx(pattern).test(cmd)
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
            'Post-upgrade task did not match any on allowedPostUpgradeCommands list'
          );
          artifactErrors.push({
            lockFile: upgrade.packageFile,
            stderr: sanitize(
              `Post-upgrade command '${cmd}' has not been added to the allowed list in allowedPostUpgradeCommands`
            ),
          });
        }
      }

      updatedArtifacts = await updateUpdatedArtifacts(
        fileFilters,
        updatedArtifacts,
        'Post-update'
      );
    }
  }
  return { updatedArtifacts, artifactErrors };
}

export default async function executePostUpgradeCommands(
  config: BranchConfig
): Promise<PostUpgradeCommandsExecutionResult | null> {
  const { allowedPostUpgradeCommands } = GlobalConfig.get();

  const hasChangedFiles =
    (config.updatedPackageFiles && config.updatedPackageFiles.length > 0) ||
    (config.updatedArtifacts && config.updatedArtifacts.length > 0);

  if (
    /* Only run post-upgrade tasks if there are changes to package files... */
    !hasChangedFiles ||
    is.emptyArray(allowedPostUpgradeCommands)
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
      postUpgradeTasks.executionMode === 'update'
  );

  const { updatedArtifacts, artifactErrors } =
    await postUpgradeCommandsExecutor(updateUpgradeCommands, config);
  return postUpgradeCommandsExecutor(branchUpgradeCommands, {
    ...config,
    updatedArtifacts,
    artifactErrors,
  });
}
