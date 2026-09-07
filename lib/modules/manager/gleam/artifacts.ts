import { isEmptyArray, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { artifactErrorResult, updateLockFile } from '../util.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`gleam.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
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
      : updatedDeps.map((dep) => dep.depName).filter(isString);

    const updateCommand = [
      'gleam deps update',
      ...packagesToUpdate.map(quote),
    ].join(' ');
    return await updateLockFile({
      lockFileName,
      existingLockFileContent: oldLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      deleteLockFile: isLockFileMaintenance,
      run: () => exec(updateCommand, execOptions),
    });
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
    return artifactErrorResult(lockFileName, err);
  }
}
