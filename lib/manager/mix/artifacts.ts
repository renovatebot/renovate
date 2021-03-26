import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile, writeLocalFile } from '../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`mix.getArtifacts(${packageFileName})`);
  if (updatedDeps.length < 1) {
    logger.debug('No updated mix deps - returning null');
    return null;
  }

  const lockFileName = 'mix.lock';
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
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

  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No mix.lock found');
    return null;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: { image: 'elixir' },
  };
  const command = ['mix', 'deps.update', ...updatedDeps.map(quote)].join(' ');

  try {
    await exec(command, execOptions);
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.warn(
      { err, message: err.message, command },
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

  const newMixLockContent = await readLocalFile(lockFileName, 'utf8');
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
