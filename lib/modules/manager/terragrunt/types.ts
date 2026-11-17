import type { PackageDependency } from '../types.ts';

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
