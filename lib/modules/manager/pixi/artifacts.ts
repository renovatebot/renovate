import is from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  deleteLocalFile,
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { getUserPixiConfig } from './extract';

export const commandLock = 'pixi lock --no-progress --color=never --quiet';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pixi.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (!is.nonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated pixi deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'pixi.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No lock file found`);
    return null;
  }
  logger.trace(`Updating ${lockFileName}`);

  const cmd = [commandLock];

  const pixiConfig = getUserPixiConfig(newPackageFileContent, packageFileName);

  const constraint =
    config.constraints?.pixi ?? pixiConfig?.project['requires-pixi'];

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
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
    await exec(cmd, execOptions);
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
          lockFile: lockFileName,
          stderr: `${err}`,
        },
      },
    ];
  }
}
