import { ensureDir, outputFile, readFile, remove } from 'fs-extra';
import { join } from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { UpdateArtifactsResult, UpdateArtifact } from '../common';
import { platform } from '../../platform';

export async function updateArtifacts({
  packageFileName: pipfileName,
  updatedDeps: _updatedDeps,
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
    if (config.isLockFileMaintenance) {
      await remove(localLockFileName);
    }
    const cmd = 'pipenv lock';
    const execOptions: ExecOptions = {
      extraEnv: {
        PIPENV_CACHE_DIR: cacheDir,
      },
      docker: {
        image: 'renovate/pipenv',
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
