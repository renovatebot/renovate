import { GetPkgReleasesConfig, getPkgReleases } from '../../../datasource';
import { logger } from '../../../logger';
import { get as getVersioning } from '../../../versioning';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../../types';
import hash from './hash';
import { ProviderLock, ProviderLockUpdate } from './types';
import {
  extractLocks,
  isPinnedVersion,
  readLockFile,
  writeLockUpdates,
} from './util';

async function updateAllLocks(
  locks: ProviderLock[],
  config: UpdateArtifactsConfig
): Promise<ProviderLockUpdate[]> {
  const updates = await Promise.all(
    locks.map(async (lock) => {
      const updateConfig: GetPkgReleasesConfig = {
        versioning: 'hashicorp',
        datasource: 'terraform-provider',
        depName: lock.lookupName,
      };
      const releasesResult = await getPkgReleases(updateConfig);
      const releases = releasesResult.releases;
      const versioning = getVersioning(updateConfig.versioning);
      const versionsList = releases.map((release) => release.version);
      const newVersion = versioning.getSatisfyingVersion(
        versionsList,
        lock.constraints
      );

      // if the new version is the same as the last, signal that no update is needed
      if (newVersion === lock.version) {
        return null;
      }
      const update: ProviderLockUpdate = {
        newVersion,
        newConstraint: lock.constraints,
        newHashes: await hash(lock.lookupName, newVersion, config.cacheDir),
        ...lock,
      };
      return update;
    })
  );
  const result = updates.filter((value) => value);
  return new Promise((resolve) => resolve(result));
}

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

  const updates: ProviderLockUpdate[] = [];
  if (config.updateType === 'lockFileMaintenance') {
    // update all locks in the file during maintenance --> only update version in constraints
    const maintenanceUpdates = await updateAllLocks(locks, config);
    updates.push(...maintenanceUpdates);
  } else {
    // update only specific locks but with constrain updates
    const lookupName = updatedDeps[0];
    const repository = lookupName.includes('/')
      ? lookupName
      : `hashicorp/${lookupName}`;
    const newConstraint = isPinnedVersion(config.newValue)
      ? config.newVersion
      : config.newValue;
    const updateLock = locks.find((value) => value.lookupName === repository);
    const update: ProviderLockUpdate = {
      newVersion: config.newVersion,
      newConstraint,
      newHashes: await hash(repository, config.newVersion, config.cacheDir),
      ...updateLock,
    };
    updates.push(update);
  }

  if (updates.length === 0) {
    return null;
  }

  const result = writeLockUpdates(updates, lockFileContent);
  return result;
}
