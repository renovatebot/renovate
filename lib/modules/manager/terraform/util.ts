import { isNonEmptyArray } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { ProviderLock } from './lockfile/types.ts';
import { extractLocks, findLockFile, readLockFile } from './lockfile/util.ts';

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
  dep.packageName ??= dep.depName;

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

export function applyOciDependency(
  dep: PackageDependency,
  source: string,
  registryAliases?: Record<string, string>,
): void {
  const url = new URL(source);

  // Strip optional `//subfolder` sub-path (e.g. `example.com/repo//modules/vpc`)
  const imageRef = (url.host + url.pathname).replace(regEx(/\/\/.+$/), '');

  const parsed = getDep(imageRef, false, registryAliases);
  dep.packageName = parsed.packageName;
  dep.datasource = parsed.datasource;
  dep.currentValue = url.searchParams.get('tag') ?? undefined;
  dep.currentDigest = url.searchParams.get('digest') ?? undefined;

  if (!dep.currentValue && !dep.currentDigest) {
    dep.skipReason = 'unspecified-version';
  }
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
      if (isNonEmptyArray(extractedLocks)) {
        locks.push(...extractedLocks);
      }
    }
  }
  return locks;
}
