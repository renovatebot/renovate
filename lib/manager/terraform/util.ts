import { TerraformDependencyTypes } from './common';

export const keyValueExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/;
export const resourceTypeExtractionRegex = /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/;

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
