import type { PackageDependency } from '../types';

export const keyValueExtractionRegex = /^\s*source\s+=\s+"(?<value>[^"]+)"\s*$/;

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}

export enum TerragruntDependencyTypes {
  unknown = 'unknown',
  terragrunt = 'terraform',
}

export interface TerraformManagerData {
  terragruntDependencyType: TerragruntDependencyTypes;
}

export enum TerragruntResourceTypes {
  unknown = 'unknown',
  /**
   * https://www.terraform.io/docs/providers/docker/r/container.html
   */
}

export interface ResourceManagerData extends TerraformManagerData {
  resourceType?: TerragruntResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
}

export function getTerragruntDependencyType(
  value: string
): TerragruntDependencyTypes {
  switch (value) {
    case 'terraform': {
      return TerragruntDependencyTypes.terragrunt;
    }
    default: {
      return TerragruntDependencyTypes.unknown;
    }
  }
}

export function checkFileContainsDependency(
  content: string,
  checkList: string[]
): boolean {
  return checkList.some((check) => content.includes(check));
}
