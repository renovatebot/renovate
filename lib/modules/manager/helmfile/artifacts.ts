import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  getParentDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function helmCommands(
  execOptions: ExecOptions,
  manifestPath: string
): Promise<void> {
  await exec(`helmfile deps ${quote(getParentDir(manifestPath))}`, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`helmfile.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmfile deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'helmfile.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');

  if (!existingLockFileContent) {
    logger.debug('No helmfile.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating Helmfile artifacts');
    const helmToolConstraint: ToolConstraint = {
      toolName: 'helmfile',
      constraint: config.constraints?.helm,
    };

    const execOptions: ExecOptions = {
      docker: {},
      extraEnv: {},
      toolConstraints: [helmToolConstraint],
    };
    await helmCommands(execOptions, packageFileName);
    logger.debug('Returning updated Helmfile artifacts');

    const fileChanges: UpdateArtifactsResult[] = [];

    if (is.truthy(existingLockFileContent)) {
      const newHelmLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged = existingLockFileContent !== newHelmLockContent;
      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newHelmLockContent,
          },
        });
      } else {
        logger.debug('helmfile.lock is unchanged');
      }
    }

    return fileChanges.length > 0 ? fileChanges : null;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Helmfile lock file');
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
