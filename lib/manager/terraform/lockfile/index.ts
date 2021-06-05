import pMap from 'p-map';
import { getAdminConfig } from '../../../config/admin';
import { GetPkgReleasesConfig, getPkgReleases } from '../../../datasource';
import { logger } from '../../../logger';
import { get as getVersioning } from '../../../versioning';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../../types';
import hash from './hash';
import type { ProviderLock, ProviderLockUpdate } from './types';
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
  const { cacheDir } = getAdminConfig();

  const updates = await pMap(
    locks,
    async (lock) => {
      const updateConfig: GetPkgReleasesConfig = {
        versioning: 'hashicorp',
        datasource: 'terraform-provider',
        depName: lock.lookupName,
      };
      const { releases } = await getPkgReleases(updateConfig);
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
        newHashes: await hash(lock.lookupName, newVersion, cacheDir),
        ...lock,
      };
      return update;
    },
    { concurrency: 4 } // allow to look up 4 lock in parallel
  );

  return updates.filter(Boolean);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`terraform.updateArtifacts(${packageFileName})`);

  // TODO remove experimental flag, if functionality is confirmed
  if (!process.env.RENOVATE_TERRAFORM_LOCK_FILE) {
    logger.debug(
      `terraform.updateArtifacts: skipping updates. Experimental feature not activated`
    );
    return null;
  }

  const { cacheDir } = getAdminConfig();

  const lockFileContent = await readLockFile(packageFileName);
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
      newHashes: await hash(repository, config.newVersion, cacheDir),
      ...updateLock,
    };
    updates.push(update);
  }

  // if no updates have been found or there are failed hashes abort
  if (
    updates.length === 0 ||
    updates.some((value) => value.newHashes == null)
  ) {
    return null;
  }

  const res = writeLockUpdates(updates, lockFileContent);
  return res ? [res] : null;
}
