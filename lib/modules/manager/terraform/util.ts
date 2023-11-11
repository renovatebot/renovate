import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type { PackageDependency } from '../types';
import type { ProviderLock } from './lockfile/types';
import { extractLocks, findLockFile, readLockFile } from './lockfile/util';

export function checkFileContainsDependency(
  content: string,
  checkList: string[],
): boolean {
  return checkList.some((check) => content.includes(check));
}

const pathStringRegex = regEx(/(.|..)?(\/[^/])+/);
export function checkIfStringIsPath(path: string): boolean {
  const match = pathStringRegex.exec(path);
  return !!match;
}

export function massageProviderLookupName(dep: PackageDependency): void {
  if (!dep.packageName) {
    dep.packageName = dep.depName;
  }

  // TODO #22198
  if (!dep.packageName!.includes('/')) {
    dep.packageName = `hashicorp/${dep.packageName!}`;
  }

  // handle cases like `Telmate/proxmox`
  // TODO #22198
  dep.packageName = dep.packageName!.toLowerCase();
}

export function getLockedVersion(
  dep: PackageDependency,
  locks: ProviderLock[],
): string | undefined {
  const depRegistryUrl = dep.registryUrls
    ? dep.registryUrls[0]
    : TerraformProviderDatasource.defaultRegistryUrls[0];
  const foundLock = locks.find(
    (lock) =>
      lock.packageName === dep.packageName &&
      lock.registryUrl === depRegistryUrl,
  );
  if (foundLock) {
    return foundLock.version;
  }
  return undefined;
}

export async function extractLocksForPackageFile(
  fileName: string,
): Promise<ProviderLock[]> {
  const locks: ProviderLock[] = [];
  const lockFilePath = await findLockFile(fileName);
  if (lockFilePath) {
    const lockFileContent = await readLockFile(lockFilePath);
    if (lockFileContent) {
      const extractedLocks = extractLocks(lockFileContent);
      if (is.nonEmptyArray(extractedLocks)) {
        locks.push(...extractedLocks);
      }
    }
  }
  return locks;
}
