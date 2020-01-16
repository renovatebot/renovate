import upath from 'upath';
import fs from 'fs-extra';
import { platform } from '../../platform';
import { exec } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { BINARY_SOURCE_DOCKER } from '../../constants/data-binary-source';

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
    config.binarySource === BINARY_SOURCE_DOCKER
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

  /* istanbul ignore next */
  try {
    const command = [...cmdParts, ...updatedDeps].join(' ');
    await exec(command, { cwd });
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

  const localLockFileName = upath.join(cwd, lockFileName);
  const newMixLockContent = await fs.readFile(localLockFileName, 'utf8');
  if (existingLockFileContent === newMixLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  logger.debug('Returning updated mix.lock');
  return [
    {
      file: {
        name: lockFileName,
        contents: newMixLockContent,
      },
    },
  ];
}
