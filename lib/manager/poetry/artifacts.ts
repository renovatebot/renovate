import is from '@sindresorhus/is';
import { parse, join } from 'upath';
import { outputFile, readFile } from 'fs-extra';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';

export async function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`poetry.updateArtifacts(${packageFileName})`);
  if (!is.nonEmptyArray(updatedDeps)) {
    logger.debug('No updated poetry deps - returning null');
    return null;
  }
  const subDirectory = parse(packageFileName).dir;
  let lockFileName = join(subDirectory, 'poetry.lock');
  let existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    lockFileName = join(subDirectory, 'pyproject.lock');
    existingLockFileContent = await platform.getFile(lockFileName);
    if (!existingLockFileContent) {
      logger.debug(`No lock file found`);
      return null;
    }
  }
  logger.debug(`Updating ${lockFileName}`);
  const localPackageFileName = join(config.localDir, packageFileName);
  const localLockFileName = join(config.localDir, lockFileName);
  try {
    await outputFile(localPackageFileName, newPackageFileContent);
    const execOptions: ExecOptions = {
      cwd: join(config.localDir, subDirectory),
    };

    if (config.binarySource === 'docker') {
      logger.info('Running poetry via docker');
      execOptions.docker = {
        image: 'renovate/poetry',
      };
    } else {
      logger.info('Running poetry via global poetry');
    }
    const cmd: string[] = [];
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      cmd.push(`poetry update --lock --no-interaction ${dep}`);
    }
    await exec(cmd, execOptions);
    const newPoetryLockContent = await readFile(localLockFileName, 'utf8');
    if (existingLockFileContent === newPoetryLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    logger.debug(`Returning updated ${lockFileName}`);
    return [
      {
        file: {
          name: lockFileName,
          contents: newPoetryLockContent,
        },
      },
    ];
  } catch (err) {
    logger.info({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.stdout + '\n' + err.stderr,
        },
      },
    ];
  }
}
