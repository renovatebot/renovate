import type { PackageDependency } from '../types';
import type {
  TerragruntDependencyTypes,
  TerragruntResourceTypes,
} from './common';

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
