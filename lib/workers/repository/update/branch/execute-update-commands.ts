import { GlobalConfig } from '../../../../config/global.ts';
import { mergeChildConfig } from '../../../../config/index.ts';
import { logger } from '../../../../logger/index.ts';
import type { ArtifactError } from '../../../../modules/manager/types.ts';
import { coerceArray } from '../../../../util/array.ts';
import { exec } from '../../../../util/exec/index.ts';
import type { ExecOptions } from '../../../../util/exec/types.ts';
import { isConstraintName, isToolName } from '../../../../util/exec/types.ts';
import { ensureLocalDir, readLocalFile } from '../../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../../util/git/auth.ts';
import { getRepoStatus } from '../../../../util/git/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import { regEx } from '../../../../util/regex.ts';
import { sanitize } from '../../../../util/sanitize.ts';
import { compile } from '../../../../util/template/index.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types.ts';

export interface CustomUpdateCommandsExecutionResult {
  updatedPackageFiles: FileChange[];
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

export async function executeCustomUpdateCommands(
  upgrade: BranchUpgradeConfig,
  config: BranchConfig,
): Promise<CustomUpdateCommandsExecutionResult> {
  const updatedPackageFiles: FileChange[] = [];
  const updatedArtifacts: FileChange[] = [];
  const artifactErrors: ArtifactError[] = [];

  const updateCommands = upgrade.customUpdateCommands;
  if (!updateCommands?.commands?.length) {
    return { updatedPackageFiles, updatedArtifacts, artifactErrors };
  }

  const { commands, fileFilters = ['**/*'] } = updateCommands;
  const allowedCommands = GlobalConfig.get('allowedCommands');

  const workingDirTemplate = updateCommands.workingDirTemplate;
  let workingDir = GlobalConfig.get('localDir');

  if (workingDirTemplate) {
    workingDir = sanitize(
      compile(workingDirTemplate, mergeChildConfig(config, upgrade)),
    );
    workingDir = await ensureLocalDir(workingDir);
    logger.trace(
      { workingDirTemplate },
      'Processed update commands working directory template.',
    );
  }

  for (const cmd of commands) {
    const compiledCmd = compile(cmd, mergeChildConfig(config, upgrade));
    if (compiledCmd !== cmd) {
      logger.debug(
        { rawCmd: cmd, compiledCmd },
        'Update command has been compiled',
      );
    }

    if (allowedCommands!.some((pattern) => regEx(pattern).test(compiledCmd))) {
      try {
        logger.trace({ cmd: compiledCmd }, 'Executing update command');

        const execOpts: ExecOptions = {
          shell: GlobalConfig.get(
            'allowShellExecutorForPostUpgradeCommands',
            false,
          ),
          cwd: workingDir,
          extraEnv: getGitEnvironmentVariables(),
        };

        if (updateCommands.installTools) {
          execOpts.toolConstraints ??= [];
          for (const [tool] of Object.entries(updateCommands.installTools)) {
            const validTool = isToolName(tool);
            const validConstraint = isConstraintName(tool);
            if (!validTool) {
              logger.warn(
                {
                  tool,
                  validTool,
                  validConstraint,
                },
                `Skipping ${validConstraint ? 'valid' : 'invalid'} constraint that is not a tool that Containerbase knows`,
              );
              continue;
            }

            execOpts.toolConstraints.push({
              toolName: tool,
              constraint: upgrade.constraints?.[tool],
            });
          }
        }

        const execResult = await exec(compiledCmd, execOpts);
        logger.debug(
          { cmd: compiledCmd, ...execResult },
          'Executed update command',
        );
      } catch (error) {
        artifactErrors.push({
          fileName: upgrade.packageFile,
          stderr: sanitize(error.message),
        });
      }
    } else {
      logger.warn(
        { cmd: compiledCmd, allowedCommands },
        'Update command did not match any entry in allowedCommands list',
      );
      artifactErrors.push({
        fileName: upgrade.packageFile,
        stderr: sanitize(
          `Update command '${compiledCmd}' has not been added to the allowed list in allowedCommands`,
        ),
      });
    }
  }

  const status = await getRepoStatus();
  logger.trace({ status }, 'git status after update commands');
  logger.debug(
    {
      addedCount: status.not_added?.length,
      modifiedCount: status.modified?.length,
      deletedCount: status.deleted?.length,
      renamedCount: status.renamed?.length,
    },
    'git status counts after update commands',
  );

  const addedOrModifiedFiles = [
    ...coerceArray(status.not_added),
    ...coerceArray(status.modified),
    ...coerceArray(status.renamed?.map((x) => x.to)),
  ];

  for (const relativePath of addedOrModifiedFiles) {
    let fileMatched = false;
    for (const pattern of fileFilters) {
      if (minimatch(pattern, { dot: true }).match(relativePath)) {
        fileMatched = true;
        logger.debug(
          { file: relativePath, pattern },
          'Update command file saved',
        );
        const contents = await readLocalFile(relativePath);
        const fileChange: FileChange = {
          type: 'addition',
          path: relativePath,
          contents,
        };
        if (relativePath === upgrade.packageFile) {
          updatedPackageFiles.push(fileChange);
        } else {
          updatedArtifacts.push(fileChange);
        }
        break;
      }
    }
    if (!fileMatched) {
      logger.debug(
        { file: relativePath },
        'Update command file did not match any file filters',
      );
    }
  }

  for (const relativePath of coerceArray(status.deleted)) {
    for (const pattern of fileFilters) {
      if (minimatch(pattern, { dot: true }).match(relativePath)) {
        logger.debug(
          { file: relativePath, pattern },
          'Update command file removed',
        );
        const fileChange: FileChange = {
          type: 'deletion',
          path: relativePath,
        };
        if (relativePath === upgrade.packageFile) {
          updatedPackageFiles.push(fileChange);
        } else {
          updatedArtifacts.push(fileChange);
        }
        break;
      }
    }
  }

  return { updatedPackageFiles, updatedArtifacts, artifactErrors };
}
