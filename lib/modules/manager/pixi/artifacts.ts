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
import { Result } from '../../../util/result';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { commandLock, pickConfig } from './lockfile';
import { LockfileYaml } from './schema';

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

  const cmd: string[] = [];

  const lockFileName = getSiblingFileName(packageFileName, 'pixi.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No lock file found`);
    return null;
  }
  logger.debug(`Updating ${lockFileName}`);

  const { val } = Result.parse(existingLockFileContent, LockfileYaml).unwrap();
  const cfg = pickConfig(val?.version);
  const constraint = cfg?.range;
  cmd.push(cfg?.cmd ?? commandLock);

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    const PIXI_CACHE_DIR = await ensureCacheDir('pixi');

    // https://pixi.sh/latest/features/environment/#caching-packages
    const extraEnv = {
      PIXI_CACHE_DIR,
      RATTLER_CACHE_DIR: PIXI_CACHE_DIR,
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv,
      docker: {},
      userConfiguredEnv: config.env,
      toolConstraints: [{ toolName: 'pixi', constraint }],
    };
    await exec(cmd, execOptions);
    const newPixiLockContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newPixiLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    logger.debug(`Returning updated ${lockFileName}`);
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
    /* v8 ignore start */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    /* v8 ignore end */

    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${err}\n${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
