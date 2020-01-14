import { parse, join } from 'upath';
import { hrtime } from 'process';
import { outputFile, readFile } from 'fs-extra';
import { exec } from '../../util/exec';
import { getChildProcessEnv } from '../../util/exec/env';
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
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated poetry deps - returning null');
    return null;
  }
  const subDirectory = parse(packageFileName).dir;
  const lockFileName = join(subDirectory, 'poetry.lock');
  let existingLockFileContent = await platform.getFile(lockFileName);
  let oldLockFileName: string;
  if (!existingLockFileContent) {
    oldLockFileName = join(subDirectory, 'pyproject.lock');
    existingLockFileContent = await platform.getFile(oldLockFileName);
    // istanbul ignore if
    if (existingLockFileContent) {
      logger.info(`${oldLockFileName} found`);
    } else {
      logger.debug(`No ${lockFileName} found`);
      return null;
    }
  }
  const localPackageFileName = join(config.localDir, packageFileName);
  const localLockFileName = join(config.localDir, lockFileName);
  let stdout: string;
  let stderr: string;
  const startTime = hrtime();
  try {
    await outputFile(localPackageFileName, newPackageFileContent);
    logger.debug(`Updating ${lockFileName}`);
    const cwd = join(config.localDir, subDirectory);
    const env = getChildProcessEnv();
    let cmd: string;
    if (config.binarySource === 'docker') {
      logger.info('Running poetry via docker');
      cmd = `docker run --rm `;
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [cwd];
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/poetry poetry`;
    } else {
      logger.info('Running poetry via global poetry');
      cmd = 'poetry';
    }
    for (let i = 0; i < updatedDeps.length; i += 1) {
      const dep = updatedDeps[i];
      cmd += ` update --lock --no-interaction ${dep}`;
      ({ stdout, stderr } = await exec(cmd, {
        cwd,
        env,
      }));
    }
    const duration = hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: `${lockFileName}`, stdout, stderr },
      'Updated lockfile'
    );
    logger.debug(`Returning updated ${lockFileName}`);
    const newPoetryLockContent = await readFile(localLockFileName, 'utf8');
    if (existingLockFileContent === newPoetryLockContent) {
      logger.debug(`${lockFileName} is unchanged`);
      return null;
    }
    let fileName: string;
    // istanbul ignore if
    if (oldLockFileName) {
      fileName = oldLockFileName;
    } else {
      fileName = lockFileName;
    }
    return [
      {
        file: {
          name: fileName,
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
          stderr: err.message,
        },
      },
    ];
  }
}
