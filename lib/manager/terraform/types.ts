import type { PackageDependency } from '../types';
import type { TerraformResourceTypes } from './common';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}

export interface ResourceManagerData {
  resourceType?: TerraformResourceTypes;
  chart?: string;
  image?: string;
  name?: string;
  repository?: string;
}
