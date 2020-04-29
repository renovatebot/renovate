import { ensureDir, outputFile, readFile } from 'fs-extra';
import { join } from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import {
  UpdateArtifactsResult,
  UpdateArtifact,
  UpdateArtifactsConfig,
} from '../common';
import { platform } from '../../platform';

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
    return (
      pipfileLock?._meta?.requires?.python_version ||
      pipfileLock?._meta?.requires?.python_full_version
    );
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
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Pipfile.lock found');
    return null;
  }
  try {
    const localPipfileFileName = join(config.localDir, pipfileName);
    await outputFile(localPipfileFileName, newPipfileContent);
    const localLockFileName = join(config.localDir, lockFileName);
    const cmd = ['pip install pipenv', 'pipenv lock'];
    let tagConstraint = getPythonConstraint(existingLockFileContent, config);
    if (tagConstraint) {
      tagConstraint = `== ${tagConstraint}`;
    }
    const execOptions: ExecOptions = {
      extraEnv: {
        PIPENV_CACHE_DIR: cacheDir,
      },
      docker: {
        image: 'renovate/python',
        tagScheme: 'pep440',
        volumes: [cacheDir],
        tagConstraint,
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
