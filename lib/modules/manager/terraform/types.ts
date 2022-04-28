import type { PackageDependency } from '../types';
import type {
  TerraformDependencyTypes,
  TerraformResourceTypes,
} from './common';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency<TerraformManagerData>[];
}

export interface TerraformManagerData {
  moduleName?: string;
  source?: string;
  sourceLine?: number;
  terraformDependencyType: TerraformDependencyTypes;
}

export interface ResourceManagerData extends TerraformManagerData {
  resourceType?: TerraformResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
}
