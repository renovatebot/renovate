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

async function conanLockUpdate(
  conanFilePath: string,
  isLockFileMaintenance: boolean | undefined,
): Promise<void> {
  const command =
    `conan lock create ${quote(conanFilePath)}` +
    (isLockFileMaintenance ? ' --lockfile=""' : '');

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

  logger.trace(`conan.updateArtifacts(${packageFileName})`);

  const { isLockFileMaintenance } = config;

  if (updatedDeps.length === 0 && !isLockFileMaintenance) {
    logger.trace('No conan.lock dependencies to update');
    return null;
  }

  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    'conan.lock',
  );
  if (!lockFileName) {
    logger.trace('No conan.lock found');
    return null;
  }

  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(`${lockFileName} read operation failed`);
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    logger.trace(`Updating ${lockFileName}`);
    await conanLockUpdate(packageFileName, isLockFileMaintenance);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (!newLockFileContent) {
      logger.debug(`New ${lockFileName} read operation failed`);
      return null;
    }

    if (existingLockFileContent === newLockFileContent) {
      logger.trace(`${lockFileName} is unchanged`);
      return null;
    }

    logger.trace(`Returning updated ${lockFileName}`);
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

    logger.debug(
      { err, packageFileName, lockFileName },
      'Lockfile update failed',
    );

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
