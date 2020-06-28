import { PackageDependency } from '../common';

export const keyValueExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/;

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}

export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
  required_providers = 'required_providers',
  resource = 'resource',
}

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
    default: {
      return TerraformDependencyTypes.unknown;
    }
  }
}

export function checkFileContainsDependency(
  content: string,
  checkList: string[]
): boolean {
  return checkList.some((check) => {
    return content.includes(check);
  });
}

export function checkIfStringIsPath(path: string): boolean {
  const regex = /(.|..)?(\/[^/])+/;
  const match = regex.exec(path);
  return !!match;
}
