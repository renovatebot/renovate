import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function conanUpdate(conanFilePath: string): Promise<void> {
  const command = `conan lock create ${quote(conanFilePath)} --lockfile=""`;

  const execOptions: ExecOptions = {
    extraEnv: { ...getGitEnvironmentVariables(['conan']) },
    docker: {},
  };

  await exec(command, execOptions);
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, config } = updateArtifact;

  logger.debug(`conan.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance =
    config.updateType === 'lockFileMaintenance' ||
    config.isLockFileMaintenance === true;
  if (!isLockFileMaintenance) {
    logger.debug('conan.lock file maintenance is turned off');
    return null;
  }

  if (!updatedDeps?.length) {
    logger.debug('No conan.file dependencies to update');
    return null;
  }

  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    'conan.lock',
  );
  if (!lockFileName) {
    logger.debug('No conan.lock found');
    return null;
  }

  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(lockFileName + ' read operation failed');
    return null;
  }

  try {
    logger.debug('Updating ' + lockFileName);
    await conanUpdate(packageFileName);
    logger.debug('Returning updated' + lockFileName);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (!newLockFileContent) {
      logger.debug('New ' + lockFileName + ' read operation failed');
      return null;
    }

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug({ err }, 'Failed to update ' + lockFileName);

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
