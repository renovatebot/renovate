import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
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
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;

  logger.debug(`conan.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance =
    config.updateType === 'lockFileMaintenance' ||
    config.isLockFileMaintenance === true;

  if (updatedDeps.length === 0 && !isLockFileMaintenance) {
    logger.debug('No conan.lock dependencies to update');
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
    await writeLocalFile(packageFileName, newPackageFileContent);

    logger.debug('Updating ' + lockFileName);
    await conanUpdate(packageFileName);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (!newLockFileContent) {
      logger.debug('New ' + lockFileName + ' read operation failed');
      return null;
    }

    if (existingLockFileContent === newLockFileContent) {
      logger.debug(lockFileName + ' is unchanged');
      return null;
    }

    logger.debug('Returning updated' + lockFileName);
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
