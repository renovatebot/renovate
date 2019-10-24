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
  await logger.debug(`cocoapods.getArtifacts(${packageFileName})`);

  if (updatedDeps.length < 1) {
    logger.debug('CocoaPods: empty update - returning null');
    return null;
  }

  if (!config.localDir) {
    logger.debug('CocoaPods: no local dir specified');
    return null;
  }

  const packageFileAbsolutePath = upath.join(config.localDir, packageFileName);
  const cwd = upath.dirname(packageFileAbsolutePath);

  const lockFileName = upath.join(
    upath.dirname(packageFileName),
    'Podfile.lock'
  );
  const lockFileAbsolutePath = upath.join(cwd, 'Podfile.lock');

  try {
    await fs.outputFile(packageFileAbsolutePath, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'Podfile could not be written');
    return [
      {
        lockFileError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug(`Lockfile not found: ${lockFileName}`);
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
          'renovate/pod pod',
        ]
      : ['pod'];
  cmdParts.push('install');

  const startTime = hrtime();
  let execResult = null;
  let execError = null;
  /* istanbul ignore next */
  try {
    const command = cmdParts.join(' ');
    execResult = await exec(command, { cwd });
  } catch (err) {
    execError = err;
  }

  const duration = hrtime(startTime);
  const seconds = Math.round(duration[0] + duration[1] / 1e9);
  logger.info({ seconds, type: 'Podfile.lock' }, 'Updated lockfile');
  logger.debug(`Returning updated lockfile: ${lockFileName}`);

  let newPodfileLockContent = null;
  try {
    newPodfileLockContent = await fs.readFile(lockFileAbsolutePath, 'utf8');
  } catch (readError) {
    const err = execError || readError;
    logger.warn(
      { err, message: err.message },
      `Failed to update lockfile: ${lockFileName}`
    );

    return [
      {
        lockFileError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  if (newPodfileLockContent === existingLockFileContent) {
    if (execError) {
      const err = execError;
      logger.warn(
        { err, message: err.message },
        `Failed to update lockfile: ${lockFileName}`
      );

      return [
        {
          lockFileError: {
            lockFile: lockFileName,
            stderr: err.message,
          },
        },
      ];
    }

    if (execResult && execResult.stderr) {
      return [
        {
          lockFileError: {
            lockFile: lockFileName,
            stderr: execResult.stderr,
          },
        },
      ];
    }

    logger.debug(`${lockFileName} is unchanged`);
    return null;
  }

  return [
    {
      file: {
        name: lockFileName,
        contents: newPodfileLockContent,
      },
    },
  ];
}
