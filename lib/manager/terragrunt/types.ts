import type { PackageDependency } from '../types';
import type {
  TerragruntDependencyTypes,
  TerragruntResourceTypes,
} from './common';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}

export interface TerraformManagerData {
  terragruntDependencyType: TerragruntDependencyTypes;
}

export interface ResourceManagerData extends TerraformManagerData {
  resourceType?: TerragruntResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
}
