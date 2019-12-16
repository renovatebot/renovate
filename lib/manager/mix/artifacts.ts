import upath from 'upath';
import fs from 'fs-extra';
import { hrtime } from 'process';
import { platform } from '../../platform';
import { exec } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';

export async function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`mix.getArtifacts(${packageFileName})`);
  if (updatedDeps.length < 1) {
    logger.debug('No updated mix deps - returning null');
    return null;
  }

  const cwd = config.localDir;
  if (!cwd) {
    logger.debug('No local dir specified');
    return null;
  }

  const lockFileName = 'mix.lock';
  try {
    const localPackageFileName = upath.join(cwd, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'mix.exs could not be written');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No mix.lock found');
    return null;
  }

  const cmdParts =
    config.binarySource === 'docker'
      ? [
          'docker',
          'run',
          '--rm',
          `-v ${cwd}:${cwd}`,
          `-w ${cwd}`,
          'renovate/mix mix',
        ]
      : ['mix'];
  cmdParts.push('deps.update');

  const startTime = hrtime();
  /* istanbul ignore next */
  try {
    const command = [...cmdParts, ...updatedDeps].join(' ');
    const { stdout, stderr } = await exec(command, { cwd });
    logger.debug(stdout);
    if (stderr) logger.warn('error: ' + stderr);
  } catch (err) {
    logger.warn(
      { err, message: err.message },
      'Failed to update Mix lock file'
    );

    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds, type: 'mix.lock' }, 'Updated lockfile');
  logger.debug('Returning updated mix.lock');

  const localLockFileName = upath.join(cwd, lockFileName);
  const newMixLockContent = await fs.readFile(localLockFileName, 'utf8');
  if (existingLockFileContent === newMixLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }

  return [
    {
      file: {
        name: lockFileName,
        contents: newMixLockContent,
      },
    },
  ];
}
