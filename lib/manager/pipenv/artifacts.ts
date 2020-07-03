import { ensureDir, outputFile, readFile, remove } from 'fs-extra';
import { join } from 'upath';
import { logger } from '../../logger';
import { platform } from '../../platform';
import { ExecOptions, exec } from '../../util/exec';
import { readLocalFile } from '../../util/fs';
import {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../common';

function getPythonConstraint(
  existingLockFileContent: string,
  config: UpdateArtifactsConfig
): string | undefined | null {
  const { compatibility = {} } = config;
  const { python } = compatibility;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }
  try {
    const pipfileLock = JSON.parse(existingLockFileContent);
    if (pipfileLock?._meta?.requires?.python_version) {
      return '== ' + pipfileLock._meta.requires.python_version + '.*';
    }
    if (pipfileLock?._meta?.requires?.python_full_version) {
      return '== ' + pipfileLock._meta.requires.python_full_version;
    }
  } catch (err) {
    // Do nothing
  }
  return undefined;
}

export async function updateArtifacts({
  packageFileName: pipfileName,
  newPackageFileContent: newPipfileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`pipenv.updateArtifacts(${pipfileName})`);

  const cacheDir =
    process.env.PIPENV_CACHE_DIR || join(config.cacheDir, './others/pipenv');
  await ensureDir(cacheDir);
  logger.debug('Using pipenv cache ' + cacheDir);

  const lockFileName = pipfileName + '.lock';
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  try {
    const localPipfileFileName = join(config.localDir, pipfileName);
    await outputFile(localPipfileFileName, newPipfileContent);
    const localLockFileName = join(config.localDir, lockFileName);
    if (config.isLockFileMaintenance) {
      await remove(localLockFileName);
    }
    const cmd = 'pipenv lock';
    const tagConstraint = getPythonConstraint(existingLockFileContent, config);
    const execOptions: ExecOptions = {
      extraEnv: {
        PIPENV_CACHE_DIR: cacheDir,
      },
      docker: {
        image: 'renovate/python',
        tagConstraint,
        tagScheme: 'pep440',
        preCommands: ['pip install --user pipenv'],
        volumes: [cacheDir],
      },
    };
    logger.debug({ cmd }, 'pipenv lock command');
    await exec(cmd, execOptions);
    const status = await platform.getRepoStatus();
    if (!(status && status.modified.includes(lockFileName))) {
      return null;
    }
    logger.debug('Returning updated Pipfile.lock');
    return [
      {
        file: {
          name: lockFileName,
          contents: await readFile(localLockFileName, 'utf8'),
        },
      },
    ];
  } catch (err) {
    logger.debug({ err }, 'Failed to update Pipfile.lock');
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
