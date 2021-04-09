import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

const lockFile = '.terraform.lock.hcl';

async function terraformLockUpdate(
  config: UpdateArtifactsConfig
): Promise<void> {
  // TODO do not hardcode
  const platformArch = ['linux_amd64', 'darwin_amd64', 'windows_amd64'];
  // const tempPathProvider = "/tmp/terraform/providers"
  const tempPathProvider = `${config.cacheDir}/terraform/providers`;

  await deleteLocalFile(lockFile);
  const execOptions: ExecOptions = {
    docker: {
      image: 'renovate/terraform',
    },
  };

  const platformParameters = platformArch
    .map((value) => `-platform=${value}`)
    .join(' ');
  const providerMirrorCMD = `terraform providers mirror ${platformParameters} ${tempPathProvider}`;
  await exec(providerMirrorCMD, execOptions);

  const providerLockCMD = `terraform providers lock -fs-mirror=${tempPathProvider} ${platformParameters}`;
  await exec(providerLockCMD, execOptions);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`terraform.updateArtifacts(${packageFileName})`);

  const lockFileName = getSiblingFileName(packageFileName, lockFile);
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No .terraform.lock.hcl found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    logger.debug('Updating ' + lockFileName);
    await terraformLockUpdate(config);
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
