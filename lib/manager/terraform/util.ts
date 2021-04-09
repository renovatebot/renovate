import type { PackageDependency } from '../types';

export const keyValueExtractionRegex = /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/;
export const resourceTypeExtractionRegex = /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/;

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
  terraform_version = 'terraform_version',
}

export interface TerraformManagerData {
  terraformDependencyType: TerraformDependencyTypes;
}

export enum TerraformResourceTypes {
  unknown = 'unknown',
  /**
   * https://www.terraform.io/docs/providers/docker/r/container.html
   */
  docker_container = 'docker_container',
  /**
   * https://www.terraform.io/docs/providers/docker/r/image.html
   */
  docker_image = 'docker_image',
  /**
   * https://www.terraform.io/docs/providers/docker/r/service.html
   */
  docker_service = 'docker_service',
  /**
   * https://www.terraform.io/docs/providers/helm/r/release.html
   */
  helm_release = 'helm_release',
}

export interface ResourceManagerData extends TerraformManagerData {
  resourceType?: TerraformResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
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
