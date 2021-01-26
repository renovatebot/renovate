import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

const lockFile = '.terraform.lock.hcl';

async function terraformLockUpdate(manifestPath: string): Promise<void> {
  await deleteLocalFile(lockFile);
  const cmd = 'terraform providers lock';

  const execOptions: ExecOptions = {
    docker: {
      image: 'renovate/terraform',
    },
  };
  await exec(cmd, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`terraform.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated terraform deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, lockFile);
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No .terraform.lock.hcl found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await terraformLockUpdate(packageFileName);
    logger.debug(`Returning updated ${lockFile}`);
    const terraformProviderLockContent = await readLocalFile(lockFileName);
    if (existingLockFileContent === terraformProviderLockContent) {
      logger.debug(`${lockFile} is unchanged`);
      return null;
    }
    return [
      {
        file: {
          name: lockFileName,
          contents: terraformProviderLockContent,
        },
      },
    ];
  } catch (err) {
    logger.warn({ err }, 'Failed to update Terraform provider lock file');
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
