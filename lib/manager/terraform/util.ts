import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import { regEx } from '../../util/regex';
import type { PackageDependency } from '../types';
import type { ProviderLock } from './lockfile/types';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/
);
export const resourceTypeExtractionRegex = regEx(
  /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/
);

export function checkFileContainsDependency(
  content: string,
  checkList: string[]
): boolean {
  return checkList.some((check) => content.includes(check));
}

const pathStringRegex = regEx(/(.|..)?(\/[^/])+/);
export function checkIfStringIsPath(path: string): boolean {
  const match = pathStringRegex.exec(path);
  return !!match;
}

export function massageProviderLookupName(dep: PackageDependency): void {
  if (!dep.lookupName) {
    dep.lookupName = dep.depName;
  }
  if (!dep.lookupName.includes('/')) {
    dep.lookupName = `hashicorp/${dep.lookupName}`;
  }

  // handle cases like `Telmate/proxmox`
  dep.lookupName = dep.lookupName.toLowerCase();
}

export function getLockedVersion(
  dep: PackageDependency,
  locks: ProviderLock[]
): string {
  const depRegistryUrl = dep.registryUrls
    ? dep.registryUrls[0]
    : TerraformProviderDatasource.defaultRegistryUrls[0];
  const foundLock = locks.find(
    (lock) =>
      lock.lookupName === dep.lookupName && lock.registryUrl === depRegistryUrl
  );
  if (foundLock) {
    return foundLock.version;
  }
  return undefined;
}
