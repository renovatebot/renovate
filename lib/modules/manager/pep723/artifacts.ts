import { isNonEmptyArray } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../util/git/auth.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { extractPep723 } from './utils.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const { isLockFileMaintenance } = config;

  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No dependencies to update');
    return null;
  }

  const lockFileName = `${packageFileName}.lock`;

  try {
    const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

    if (!existingLockFileContent) {
      logger.debug({ lockFileName }, 'No uv lock file found');
      return null;
    }

    const parsedPackageFile = extractPep723(
      newPackageFileContent,
      packageFileName,
    );

    const pythonConstraint: ToolConstraint = {
      toolName: 'python',
      constraint:
        config.constraints?.python ??
        parsedPackageFile?.extractedConstraints?.python,
    };
    const uvConstraint: ToolConstraint = {
      toolName: 'uv',
      constraint: config.constraints?.uv,
    };

    // TODO: Set credentials if indexes are set (https://docs.astral.sh/uv/guides/scripts/#using-alternative-package-indexes).
    const extraEnv = getGitEnvironmentVariables(['pep723']);
    const execOptions: ExecOptions = {
      extraEnv,
      docker: {},
      toolConstraints: [pythonConstraint, uvConstraint],
    };

    let cmd: string;
    if (isLockFileMaintenance) {
      cmd = `uv lock --script ${quote(packageFileName)} --upgrade`;
    } else {
      cmd = `uv lock --script ${quote(packageFileName)} ${updatedDeps.map((dep) => `--upgrade-package ${quote(dep.depName!)}`).join(' ')}`;
    }

    await exec(cmd, execOptions);

    // check for changes
    const fileChanges: UpdateArtifactsResult[] = [];
    const newLockContent = await readLocalFile(lockFileName, 'utf8');
    const isLockFileChanged = existingLockFileContent !== newLockContent;

    if (isLockFileChanged) {
      fileChanges.push({
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockContent,
        },
      });
    } else {
      logger.debug({ lockFileName }, 'uv lock file is unchanged');
    }

    return fileChanges.length ? fileChanges : null;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug({ err }, 'Failed to update uv lock file');

    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
