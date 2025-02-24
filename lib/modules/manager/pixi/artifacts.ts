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
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { Result } from '../../../util/result';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { pickPixiBasedOnLockVersion } from './lockfile';
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

  const lockFileName = getSiblingFileName(packageFileName, 'pixi.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No lock file found`);
    return null;
  }
  logger.debug(`Updating ${lockFileName}`);
  let pixiConstraint: string | undefined = undefined;
  const { val, err } = Result.parse(
    existingLockFileContent,
    LockfileYaml,
  ).unwrap();
  if (!err) {
    // istanbul ignore if
    if (val.version <= 5) {
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: 'lock file version < 6 is not support.',
          },
        },
      ];
    }
    pixiConstraint = pickPixiBasedOnLockVersion(val.version);
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    const cmd: string[] = [];
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }
    cmd.push('pixi lock --no-progress --color=never --quiet');

    const extraEnv = {
      ...getGitEnvironmentVariables(['pypi']),
      // https://pixi.sh/latest/features/environment/#caching-packages
      PIXI_CACHE_DIR: await ensureCacheDir('pixi'),
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv,
      docker: {},
      userConfiguredEnv: config.env,
      toolConstraints: [{ toolName: 'pixi', constraint: pixiConstraint }],
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
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
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
