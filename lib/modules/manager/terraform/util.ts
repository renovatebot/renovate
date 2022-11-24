import { regEx } from '../../../util/regex';
import { TerraformProviderDatasource } from '../../datasource/terraform-provider';
import type { PackageDependency } from '../types';
import type { TerraformDependencyTypes } from './common';
import type { ProviderLock } from './lockfile/types';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/
);
export const resourceTypeExtractionRegex = regEx(
  /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/
);

export function getTerraformDependencyType(
  value: string
): TerraformDependencyTypes {
  switch (value) {
    case 'module': {
      return 'module';
    }
    case 'provider': {
      return 'provider';
    }
    case 'required_providers': {
      return 'required_providers';
    }
    case 'resource': {
      return 'resource';
    }
    case 'terraform': {
      return 'terraform_version';
    }
    default: {
      return 'unknown';
    }
  }
}

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
  if (!dep.packageName) {
    dep.packageName = dep.depName;
  }

  // TODO #7154
  if (!dep.packageName!.includes('/')) {
    dep.packageName = `hashicorp/${dep.packageName!}`;
  }

  // handle cases like `Telmate/proxmox`
  // TODO #7154
  dep.packageName = dep.packageName!.toLowerCase();
}

export function getLockedVersion(
  dep: PackageDependency,
  locks: ProviderLock[]
): string | undefined {
  const depRegistryUrl = dep.registryUrls
    ? dep.registryUrls[0]
    : TerraformProviderDatasource.defaultRegistryUrls[0];
  const foundLock = locks.find(
    (lock) =>
      lock.packageName === dep.packageName &&
      lock.registryUrl === depRegistryUrl
  );
  if (foundLock) {
    return foundLock.version;
  }
  return undefined;
}
