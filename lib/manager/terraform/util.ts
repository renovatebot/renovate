import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type { PackageDependency } from '../types';
import { TerraformDependencyTypes } from './common';
import type { ProviderLock } from './lockfile/types';

export const keyValueExtractionRegex =
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/;
export const resourceTypeExtractionRegex =
  /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/;

export function getTerraformDependencyType(
  value: string
): TerraformDependencyTypes {
  switch (value) {
    case 'module': {
      return TerraformDependencyTypes.module;
    }
    case 'provider': {
      return TerraformDependencyTypes.provider;
    }
    case 'required_providers': {
      return TerraformDependencyTypes.required_providers;
    }
    case 'resource': {
      return TerraformDependencyTypes.resource;
    }
    case 'terraform': {
      return TerraformDependencyTypes.terraform_version;
    }
    default: {
      return TerraformDependencyTypes.unknown;
    }
  }
}

export function checkFileContainsDependency(
  content: string,
  checkList: string[]
): boolean {
  return checkList.some((check) => content.includes(check));
}

const pathStringRegex = /(.|..)?(\/[^/])+/;
export function checkIfStringIsPath(path: string): boolean {
  const match = pathStringRegex.exec(path);
  return !!match;
}

export function massageProviderLookupName(dep: PackageDependency): void {
  /* eslint-disable no-param-reassign */
  if (!dep.lookupName) {
    dep.lookupName = dep.depName;
  }
  if (!dep.lookupName.includes('/')) {
    dep.lookupName = `hashicorp/${dep.lookupName}`;
  }

  // handle cases like `Telmate/proxmox`
  dep.lookupName = dep.lookupName.toLowerCase();
  /* eslint-enable no-param-reassign */
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
