import { PackageDependency } from '../common';

export const keyValueExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/;
export const githubRefMatchRegex = /github.com([/:])(?<project>[^/]+\/[a-z0-9-.]+).*\?ref=(?<tag>.*)$/;
export const gitTagsRefMatchRegex = /(?:git::)?(?<url>(?:http|https|ssh):\/\/(?:.*@)?(?<path>.*.*\/(?<project>.*\/.*)))\?ref=(?<tag>.*)$/;

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}

export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
  required_providers = 'required_providers',
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
