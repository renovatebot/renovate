import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`gleam.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (is.emptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated gleam deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'manifest.toml');

  const oldLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!oldLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        {
          toolName: 'gleam',
          constraint: config.constraints?.gleam,
        },
      ],
    };

    // `gleam deps update` with no packages rebuilds the lock file
    const packagesToUpdate = isLockFileMaintenance
      ? []
      : updatedDeps.map((dep) => dep.depName).filter(is.string);

    const updateCommand = ['gleam deps update', ...packagesToUpdate].join(' ');
    await exec(updateCommand, execOptions);
    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!newLockFileContent) {
      logger.debug(`No ${lockFileName} found`);
      return null;
    }
    if (oldLockFileContent === newLockFileContent) {
      logger.debug(`No changes in ${lockFileName} content`);
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
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
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
