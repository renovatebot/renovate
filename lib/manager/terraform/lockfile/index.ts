import { logger } from '../../../logger';
import type { UpdateArtifact, UpdateArtifactsResult } from '../../types';
import { createHashes } from './hash';
import { ProviderLockUpdate } from './types';
import {
  extractLocks,
  isPinnedVersion,
  readLockFile,
  writeLockUpdates,
} from './util';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`terraform.updateArtifacts(${packageFileName})`);

  const lockFileContent = await readLockFile();
  if (!lockFileContent) {
    logger.debug('No .terraform.lock.hcl found');
    return null;
  }
  const locks = extractLocks(lockFileContent);
  if (!locks) {
    logger.debug('No Locks in .terraform.lock.hcl found');
    return null;
  }
  const lookupName = updatedDeps[0];
  const repository = lookupName.includes('/')
    ? lookupName
    : `hashicorp/${lookupName}`;

  const updates: ProviderLockUpdate[] = [];
  if (config.updateType === 'lockFileMaintenance') {
    // TODO update lock file independent of updates
  } else {
    const newConstraint = isPinnedVersion(config.newValue)
      ? config.newVersion
      : config.newValue;
    const updateLock = locks.find((value) => value.lookupName === repository);
    const update: ProviderLockUpdate = {
      newVersion: config.newVersion,
      newConstraint,
      newHashes: await createHashes(
        repository,
        config.newVersion,
        config.cacheDir
      ),
      ...updateLock,
    };
    updates.push(update);
  }

  const result = writeLockUpdates(updates, lockFileContent);
  logger.trace({ result }, `terraform.updateArtifacts(${packageFileName})`);
  return result;
}
