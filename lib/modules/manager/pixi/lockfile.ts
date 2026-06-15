import { isNonEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import type { PackageDependency, UpdateArtifactsResult } from '../types.ts';

export const commandLock = 'pixi lock --no-progress --color=never --quiet';

export interface UpdatePixiLockfile {
  packageFileName: string;
  updatedDeps: PackageDependency[] | undefined;
  isLockFileMaintenance: boolean | undefined;
  /** `pixi` version constraint passed to the tool installer. */
  constraint: string | undefined;
  /**
   * When set, the content is written to `packageFileName` before running
   * `pixi lock`. Callers that have already written the package file to disk
   * (e.g. the `pep621` manager) should leave this `undefined`.
   */
  newPackageFileContent?: string;
}

/**
 * Regenerate the sibling `pixi.lock` of a package file by running `pixi lock`.
 *
 * Shared by the standalone `pixi` manager and the `pep621` pixi processor.
 */
export async function updatePixiLockfile({
  packageFileName,
  updatedDeps,
  isLockFileMaintenance,
  constraint,
  newPackageFileContent,
}: UpdatePixiLockfile): Promise<UpdateArtifactsResult[] | null> {
  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated pixi deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'pixi.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No pixi.lock found');
    return null;
  }

  try {
    if (newPackageFileContent !== undefined) {
      await writeLocalFile(packageFileName, newPackageFileContent);
    }
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    // https://pixi.sh/latest/features/environment/#caching-packages
    const PIXI_CACHE_DIR = await ensureCacheDir('pixi');
    const extraEnv = {
      PIXI_CACHE_DIR,
      RATTLER_CACHE_DIR: PIXI_CACHE_DIR,
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv,
      docker: {},
      toolConstraints: [{ toolName: 'pixi', constraint }],
    };
    await exec([commandLock], execOptions);

    const newPixiLockContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newPixiLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newPixiLockContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: `${err}`,
        },
      },
    ];
  }
}
