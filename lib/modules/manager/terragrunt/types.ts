import type { PackageDependency } from '../types.ts';

export type TerragruntResourceTypes = 'unknown';
export type TerragruntDependencyTypes = 'unknown' | 'terraform';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency<TerraformManagerData>[];
}

export interface TerraformManagerData {
  moduleName: string;
  source?: string;
  sourceLine?: number;
  terragruntDependencyType: TerragruntDependencyTypes;
}

export interface ResourceManagerData extends TerraformManagerData {
  resourceType?: TerragruntResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
}
