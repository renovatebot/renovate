import { isNonEmptyArray } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';
import { getLockFileName } from './extract.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!isNonEmptyArray(updatedDeps) && !config.isLockFileMaintenance) {
    return null;
  }

  const lockFileName = getLockFileName(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No ${lockFileName} found`);
    return null;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'apko',
        constraint: await resolveToolConstraint(config, 'apko'),
      },
    ],
  };
  try {
    return await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: () =>
        exec(
          `apko lock ${quote(upath.basename(packageFileName))}`,
          execOptions,
        ),
    });
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err, packageFile: packageFileName }, 'apko lock failed');
    return artifactErrorResult(lockFileName, err);
  }
}
