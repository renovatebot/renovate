import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  getSiblingFileName,
  getSubDirectory,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

async function helmCommands(
  manifestPath: string,
  aliases?: Record<string, string>
): Promise<void> {
  const execOptions: ExecOptions = {
    docker: {
      image: 'helm',
    },
    extraEnv: {
      HELM_EXPERIMENTAL_OCI: '1',
    },
  };
  const cmd = [];

  if (aliases) {
    Object.entries(aliases).forEach(([alias, url]) =>
      cmd.push(`helm repo add ${quote(alias)} ${quote(url)}`)
    );
  }
  cmd.push(`helm dependency update ${quote(getSubDirectory(manifestPath))}`);

  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`helmv3.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmv3 deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'Chart.lock');
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Chart.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await helmCommands(packageFileName, config.aliases);
    logger.debug('Returning updated Chart.lock');
    const newHelmLockContent = await readLocalFile(lockFileName);
    if (existingLockFileContent === newHelmLockContent) {
      logger.debug('Chart.lock is unchanged');
      return null;
    }
    return [
      {
        file: {
          name: lockFileName,
          contents: newHelmLockContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ err }, 'Failed to update Helm lock file');
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
