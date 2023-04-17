import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function krakenUpgrade(): Promise<void> {
  const cmd = `krakenw --upgrade lock`;
  await exec(cmd);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.info(`kraken.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated kraken deps - returning null');
    return null;
  }

  const lockFileName = await findLocalSiblingOrParent(
    packageFileName,
    '.kraken.lock'
  );
  const existingLockFileContent = lockFileName
    ? await readLocalFile(lockFileName)
    : null;
  if (!existingLockFileContent || !lockFileName) {
    logger.info('No .kraken.lock found');
    return null;
  }

  try {
    logger.info('Updating ' + lockFileName);
    await krakenUpgrade();
    const newKrakenLockContent = await readLocalFile(lockFileName);
    if (existingLockFileContent === newKrakenLockContent) {
      logger.info('.kraken.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newKrakenLockContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.info({ err }, 'Failed to update Kraken lock file');
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
