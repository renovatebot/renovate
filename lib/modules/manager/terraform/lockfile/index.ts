import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import * as p from '../../../../util/promises';
import { GetPkgReleasesConfig, getPkgReleases } from '../../../datasource';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import { get as getVersioning } from '../../../versioning';
import type { UpdateArtifact, UpdateArtifactsResult } from '../../types';
import { massageProviderLookupName } from '../util';
import { TerraformProviderHash } from './hash';
import type { ProviderLock, ProviderLockUpdate } from './types';
import {
  extractLocks,
  findLockFile,
  isPinnedVersion,
  readLockFile,
  writeLockUpdates,
} from './util';

async function updateAllLocks(
  locks: ProviderLock[]
): Promise<ProviderLockUpdate[]> {
  const updates = await p.map(
    locks,
    async (lock) => {
      const updateConfig: GetPkgReleasesConfig = {
        versioning: 'hashicorp',
        datasource: 'terraform-provider',
        packageName: lock.packageName,
      };
      const { releases } = (await getPkgReleases(updateConfig)) ?? {};
      if (!releases) {
        return null;
      }
      const versioning = getVersioning(updateConfig.versioning);
      const versionsList = releases.map((release) => release.version);
      const newVersion = versioning.getSatisfyingVersion(
        versionsList,
        lock.constraints
      );

      // if the new version is the same as the last, signal that no update is needed
      if (!newVersion || newVersion === lock.version) {
        return null;
      }
      const update: ProviderLockUpdate = {
        newVersion,
        newConstraint: lock.constraints,
        newHashes:
          (await TerraformProviderHash.createHashes(
            lock.registryUrl,
            lock.packageName,
            newVersion
          )) ?? [],
        ...lock,
      };
      return update;
    },
    { concurrency: 4 }
  );

  return updates.filter(is.truthy);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`terraform.updateArtifacts(${packageFileName})`);

  const lockFilePath = await findLockFile(packageFileName);

  if (!lockFilePath) {
    logger.debug('No .terraform.lock.hcl found');
    return null;
  }

  try {
    const lockFileContent = await readLockFile(lockFilePath);
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
      const maintenanceUpdates = await updateAllLocks(locks);
      updates.push(...maintenanceUpdates);
    } else {
      const providerDeps = updatedDeps.filter((dep) =>
        // TODO #22198
        ['provider', 'required_provider'].includes(dep.depType!)
      );
      for (const dep of providerDeps) {
        massageProviderLookupName(dep);
        const {
          registryUrls,
          currentValue,
          currentVersion,
          newValue,
          newVersion,
          packageName,
        } = dep;

        const registryUrl = registryUrls
          ? registryUrls[0]
          : TerraformProviderDatasource.defaultRegistryUrls[0];
        const updateLock = locks.find(
          (value) => value.packageName === packageName
        );
        // istanbul ignore if: needs test
        if (!updateLock) {
          continue;
        }
        let newConstraint: string | undefined = updateLock.constraints;
        if (newConstraint && currentValue === newValue) {
          logger.debug(
            `Leaving constraints "${newConstraint}" unchanged for "${packageName}" as current and new values are the same`
          );
        } else if (
          newConstraint &&
          currentValue &&
          newValue &&
          newConstraint.includes(currentValue)
        ) {
          logger.debug(
            `Updating constraint "${newConstraint}" to replace "${currentValue}" with "${newValue}" for "${packageName}"`
          );
          newConstraint = newConstraint.replace(currentValue, newValue);
        } else if (
          newConstraint &&
          currentVersion &&
          newVersion &&
          newConstraint.includes(currentVersion)
        ) {
          logger.debug(
            `Updating constraint "${newConstraint}" to replace "${currentVersion}" with "${newVersion}" for "${packageName}"`
          );
          newConstraint = newConstraint.replace(currentVersion, newVersion);
        } else {
          newConstraint = isPinnedVersion(newValue) ? newVersion : newValue;
          logger.debug(
            `Could not detect constraint to update for "${packageName}" so setting to newValue "${newConstraint}"`
          );
        }
        const update: ProviderLockUpdate = {
          // TODO #22198
          newVersion: newVersion!,
          newConstraint: newConstraint!,
          newHashes:
            (await TerraformProviderHash.createHashes(
              registryUrl,
              updateLock.packageName,
              newVersion!
            )) ?? /* istanbul ignore next: needs test */ [],
          ...updateLock,
        };
        updates.push(update);
      }
    }
    // if no updates have been found or there are failed hashes abort
    if (
      updates.length === 0 ||
      updates.some((value) => !value.newHashes?.length)
    ) {
      return null;
    }

    const res = writeLockUpdates(updates, lockFilePath, lockFileContent);
    return [res];
  } catch (err) {
    /* istanbul ignore next */
    return [
      {
        artifactError: {
          lockFile: lockFilePath,
          stderr: err.message,
        },
      },
    ];
  }
}
