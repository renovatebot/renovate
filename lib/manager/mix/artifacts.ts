import upath from 'upath';
import fs from 'fs-extra';
import { hrtime } from 'process';
import { platform } from '../../platform';
import { exec } from '../../util/exec';
import { logger } from '../../logger';

export async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug(`mix.getArtifacts(${packageFileName})`);
  if (updatedDeps === undefined || updatedDeps.length < 1) {
    logger.debug('No updated mix deps - returning null');
    return null;
  }
  if (!config.localDir) {
    logger.debug('No local dir specified');
    return null;
  }
  const cwd = config.localDir;
  const lockFileName = 'mix.lock';
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err, message: err.message }, 'mix.exs is not found');
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }

  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No mix.lock found');
    return null;
  }
  let cmd;
  // istanbul ignore if
  if (config.binarySource === 'docker') {
    logger.info('Running mix via docker');
    cmd = `docker run --rm `;
    const volumes = [cwd];
    cmd += volumes.map(v => `-v ${v}:${v} `).join('');
    const envVars = [];
    cmd += envVars.map(e => `-e ${e} `);
    cmd += `-w ${cwd} `;
    cmd += `renovate/mix mix`;
  } else {
    logger.info('Running mix via global mix');
    cmd = 'mix';
  }
  const localLockFileName = upath.join(config.localDir, lockFileName);
  let unlockCmd = `${cmd} deps.unlock `;
  const getCmd = `${cmd} deps.get`;
  for (let i = 0; i < updatedDeps.length; i += 1) {
    unlockCmd += updatedDeps[i].depName;
  }

  const startTime = hrtime();
  /* istanbul ignore next */
  try {
    const { stdout, stderr } = await exec(unlockCmd, {
      cwd: config.localDir,
    });
    logger.debug(stdout);
    if (stderr) logger.warn('error: ' + stderr);
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to unlock Mix lock file'
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
  /* istanbul ignore next */
  try {
    const { stdout, stderr } = await exec(getCmd, {
      cwd: config.localDir,
    });
    logger.debug(stdout);
    if (stderr) logger.warn('error: ' + stderr);
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to update Mix lock file'
    );
    return {
      lockFileError: {
        lockFile: lockFileName,
        stderr: err.message,
      },
    };
  }
  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds, type: 'mix.lock' }, 'Updated lockfile');
  logger.debug('Returning updated mix.lock');
  const newCargoLockContent = await fs.readFile(localLockFileName, 'utf8');
  if (existingLockFileContent === newCargoLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  return [
    {
      file: {
        name: lockFileName,
        contents: newCargoLockContent,
      },
    },
  ];
}
