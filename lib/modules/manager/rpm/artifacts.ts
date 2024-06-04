import type { UpdateArtifact, UpdateArtifactsResult } from "../types";
import { logger } from "../../../logger";
import { deleteLocalFile, readLocalFile, localPathExists } from "../../../util/fs";
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`rpm.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (!isLockFileMaintenance) {
    logger.debug('Must be in lockFileMaintenance for rpm manager');
    return null;
  }

  let extension = packageFileName.split('.').pop();
  let lockFileName = `rpms.lock.${extension}`;

  logger.debug(`RPM lock file: ${lockFileName}`);

  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  let containerFileName: string = 'Dockerfile';

  if (await localPathExists('Dockerfile')) {
    logger.debug(`Using Dockerfile`);
  } else if (await localPathExists('Containerfile')) {
    logger.debug(`Using Containerfile`);
    containerFileName = 'Containerfile';
  } else {
    logger.warn('Neither Dockerfile nor Containerfile present in repository, skipping RPM lockfile maintenance');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: 'Neither Dockerfile nor Containerfile present in repository, skipping RPM lockfile maintenance',
        },
      },
    ]
  }

  logger.debug(`Updating ${lockFileName}`);

  const cmd: string[] = [];

  try {
    await deleteLocalFile(lockFileName);

    cmd.push(`rpm-lockfile-prototype -f ${containerFileName} ${packageFileName}`);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,

    }

    await exec(cmd, execOptions);

    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');

    if (existingLockFileContent === newLockFileContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }

    logger.debug(`Returning updated ${lockFileName}`);

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        }
      }
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
