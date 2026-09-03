import { isNonEmptyArray } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
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
import type { UpdateArtifactsResult } from '../types.ts';
import type { UpdatePixiLockfile } from './types.ts';

export const commandLock = 'pixi lock --no-progress --color=never --quiet';

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

  // `pixi lock` can execute arbitrary code from conda package hooks, so it is
  // gated behind `allowedUnsafeExecutions`.
  // https://pixi.prefix.dev/latest/security/#4-treat-package-hooks-as-code-execution
  if (!GlobalConfig.get('allowedUnsafeExecutions').includes('pixi')) {
    logger.once.warn(
      '`pixi lock` was requested to run, but `pixi` is not permitted in the allowedUnsafeExecutions',
    );
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
