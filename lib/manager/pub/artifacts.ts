import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function pubUpdate(
  pubspecPath: string,
  newPackageFileContent: string
): Promise<void> {
  let cmd = '';
  if (newPackageFileContent.includes('sdk: flutter')) {
    cmd = 'flutter pub upgrade';
  } else {
    cmd = 'pub upgrade';
  }

  const execOptions: ExecOptions = {
    cwdFile: pubspecPath,
    docker: {
      image: 'cirrusci/flutter:latest', // Ideally there would be an official image, but this at least gets updated very frequently
    },
  };
  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pub.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated pub deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'pubspec.lock');
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No pubspec.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await pubUpdate(packageFileName, newPackageFileContent);
    logger.debug('Returning updated pubspec.lock');
    const newPubspecLockContent = await readLocalFile(lockFileName);
    if (
      existingLockFileContent === newPubspecLockContent ||
      newPubspecLockContent === undefined
    ) {
      logger.debug('pubspec.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          name: lockFileName,
          contents: newPubspecLockContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ err }, 'Failed to update pubspec.lock file');
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
