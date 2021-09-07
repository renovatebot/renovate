import pMap from 'p-map';
import { GetPkgReleasesConfig, getPkgReleases } from '../../../datasource';
import { TerraformProviderDatasource } from '../../../datasource/terraform-provider';
import { logger } from '../../../logger';
import { get as getVersioning } from '../../../versioning';
import type { UpdateArtifact, UpdateArtifactsResult } from '../../types';
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
        newHashes: await TerraformProviderHash.createHashes(
          lock.registryUrl,
          lock.lookupName,
          newVersion
        ),
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

  const lockFilePath = findLockFile(packageFileName);
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
      const filteredUpdates = updatedDeps.filter((dep) =>
        ['provider', 'required_provider'].includes(dep.depType)
      );
      const lockUpdates = await pMap(
        filteredUpdates,
        async (dep) => {
          const lookupName = dep.lookupName ?? dep.depName;

          // handle cases like `Telmate/proxmox`
          const massagedLookupName = lookupName.toLowerCase();

          const repository = massagedLookupName.includes('/')
            ? massagedLookupName
            : `hashicorp/${massagedLookupName}`;
          const registryUrl = dep.registryUrls
            ? dep.registryUrls[0]
            : TerraformProviderDatasource.defaultRegistryUrls[0];
          const newConstraint = isPinnedVersion(dep.newValue)
            ? dep.newVersion
            : dep.newValue;
          const updateLock = locks.find(
            (value) => value.lookupName === repository
          );
          const update: ProviderLockUpdate = {
            newVersion: dep.newVersion,
            newConstraint,
            newHashes: await TerraformProviderHash.createHashes(
              registryUrl,
              repository,
              dep.newVersion
            ),
            ...updateLock,
          };
          return update;
        },
        { concurrency: 4 }
      );

      updates.push(...lockUpdates);
    }
    // if no updates have been found or there are failed hashes abort
    if (
      updates.length === 0 ||
      updates.some((value) => value.newHashes == null)
    ) {
      return null;
    }

    const res = writeLockUpdates(updates, lockFilePath, lockFileContent);
    return res ? [res] : null;
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
